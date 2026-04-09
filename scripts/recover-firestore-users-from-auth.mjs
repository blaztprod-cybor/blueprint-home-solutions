import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(repoRoot, '.env.local') });
dotenv.config();

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    allUsers: false,
    allNonAdmin: false,
    emails: [],
    emailsFile: '',
    projectId: '',
    databaseId: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--write') args.dryRun = false;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--all-users') args.allUsers = true;
    else if (token === '--all-non-admin') args.allNonAdmin = true;
    else if (token === '--email') args.emails.push(argv[i + 1] || '');
    else if (token === '--emails-file') args.emailsFile = argv[i + 1] || '';
    else if (token === '--project') args.projectId = argv[i + 1] || '';
    else if (token === '--database') args.databaseId = argv[i + 1] || '';

    if (['--email', '--emails-file', '--project', '--database'].includes(token)) {
      i += 1;
    }
  }

  return {
    ...args,
    emails: args.emails
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  };
}

function loadEmailList(emailsFile) {
  if (!emailsFile) return [];
  return fs
    .readFileSync(path.resolve(process.cwd(), emailsFile), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

function stripUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function createAdminApp(projectId) {
  if (getApps().length) return getApps()[0];

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

function getDatabase(app, databaseId) {
  return databaseId && databaseId !== '(default)'
    ? getFirestore(app, databaseId)
    : getFirestore(app);
}

async function listAllAuthUsers(auth) {
  const users = [];
  let nextPageToken;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

function resolveRole(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized === 'blaztprod@gmail.com') return 'admin';
  if (normalized.includes('contractor') || normalized.includes('builder') || normalized.includes('trades')) {
    return 'Contractor';
  }
  return 'Homeowner';
}

function buildAccountPayload(authUser) {
  const createdAt = authUser.metadata.creationTime
    ? new Date(authUser.metadata.creationTime).toISOString()
    : new Date().toISOString();
  const role = resolveRole(authUser.email);
  const isContractor = role === 'Contractor';
  const trialEndsAt = new Date(createdAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  return stripUndefined({
    uid: authUser.uid,
    email: authUser.email || '',
    role,
    isVerified: role === 'admin' ? true : false,
    isDisabled: authUser.disabled || false,
    licenseStatus: isContractor ? 'Pending' : undefined,
    accountPlan: isContractor ? 'trial' : 'standard',
    trialStartedAt: isContractor ? createdAt : undefined,
    trialEndsAt: isContractor ? trialEndsAt.toISOString() : undefined,
    subscriptionLevel: isContractor ? 'trial' : 'none',
    createdAt,
    updatedAt: new Date().toISOString(),
  });
}

function buildProfilePayload(authUser) {
  const role = resolveRole(authUser.email);
  const localPart = String(authUser.email || 'user').split('@')[0];
  const name = authUser.displayName || localPart;

  return stripUndefined({
    uid: authUser.uid,
    name,
    notifyOnNewProjects: role === 'Contractor',
    notifyOnRoughEstimates: role === 'Homeowner',
    notifyOnProductUpdates: role === 'Contractor',
    notifyOnSmsLeadAlerts: false,
    leadCategories: role === 'Contractor' ? [] : undefined,
    updatedAt: new Date().toISOString(),
  });
}

function filterAuthUsers(users, { allUsers, allNonAdmin, emails }) {
  if (allUsers) return users;
  if (allNonAdmin) {
    return users.filter((user) => resolveRole(user.email) !== 'admin');
  }

  const emailSet = new Set(emails);
  return users.filter((user) => emailSet.has(String(user.email || '').toLowerCase()));
}

function describeRun({ projectId, databaseId, dryRun, allUsers, allNonAdmin, emails }) {
  console.log(`Project: ${projectId}`);
  console.log(`Firestore database: ${databaseId || '(default)'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  if (allUsers) {
    console.log('Target: all Auth users');
    return;
  }
  if (allNonAdmin) {
    console.log('Target: all non-admin Auth users');
    return;
  }
  console.log(`Target emails: ${emails.join(', ') || '(none)'}`);
}

async function recoverUsers(db, authUsers, dryRun) {
  let recoveredAccounts = 0;
  let recoveredProfiles = 0;

  for (const authUser of authUsers) {
    if (!authUser.email) continue;

    const accountPayload = buildAccountPayload(authUser);
    const profilePayload = buildProfilePayload(authUser);

    console.log(
      `${dryRun ? '[dry-run] would recover' : 'recovering'} ${authUser.uid} (${authUser.email}) as ${accountPayload.role}`
    );

    if (!dryRun) {
      const batch = db.batch();
      batch.set(db.collection('users').doc(authUser.uid), accountPayload, { merge: true });
      batch.set(db.collection('user_profiles').doc(authUser.uid), profilePayload, { merge: true });
      await batch.commit();
    }

    recoveredAccounts += 1;
    recoveredProfiles += 1;
  }

  return { recoveredAccounts, recoveredProfiles };
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2));
  const firebaseConfig = loadJson(path.join(repoRoot, 'firebase-applet-config.json'));
  const projectId = cliArgs.projectId || firebaseConfig.projectId;
  const databaseId = cliArgs.databaseId || firebaseConfig.firestoreDatabaseId || '(default)';
  const emails = [...new Set([...cliArgs.emails, ...loadEmailList(cliArgs.emailsFile)])];

  if (!cliArgs.allUsers && !cliArgs.allNonAdmin && emails.length === 0) {
    console.error('Provide --all-users, --all-non-admin, or at least one --email / --emails-file.');
    process.exit(1);
  }

  describeRun({
    projectId,
    databaseId,
    dryRun: cliArgs.dryRun,
    allUsers: cliArgs.allUsers,
    allNonAdmin: cliArgs.allNonAdmin,
    emails,
  });

  const app = createAdminApp(projectId);
  const db = getDatabase(app, databaseId);
  const auth = getAuth(app);

  const authUsers = filterAuthUsers(await listAllAuthUsers(auth), {
    allUsers: cliArgs.allUsers,
    allNonAdmin: cliArgs.allNonAdmin,
    emails,
  });

  if (!authUsers.length) {
    console.log('No matching Firebase Auth users found.');
    return;
  }

  console.log(`Matched ${authUsers.length} Auth user(s).`);
  const result = await recoverUsers(db, authUsers, cliArgs.dryRun);
  console.log(
    `${cliArgs.dryRun ? 'Dry run complete' : 'Recovery complete'}: ` +
    `${result.recoveredAccounts} account doc(s), ${result.recoveredProfiles} profile doc(s).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
