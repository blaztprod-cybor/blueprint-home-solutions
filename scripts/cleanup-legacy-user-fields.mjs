import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const LEGACY_PROFILE_FIELDS = [
  'name',
  'phone',
  'street',
  'town',
  'zip',
  'avatar',
  'governmentIdImage',
  'licenseNumber',
  'isTradesman',
  'trade',
  'leadCategories',
  'notifyOnNewProjects',
  'notifyOnRoughEstimates',
  'notifyOnProductUpdates',
  'notifyOnSmsLeadAlerts',
  'smsConsentAt',
];

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

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--write') args.dryRun = false;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--all-users') args.allUsers = true;
    else if (token === '--all-non-admin') args.allNonAdmin = true;
    else if (token === '--email') args.emails.push(argv[index + 1] || '');
    else if (token === '--emails-file') args.emailsFile = argv[index + 1] || '';
    else if (token === '--project') args.projectId = argv[index + 1] || '';
    else if (token === '--database') args.databaseId = argv[index + 1] || '';

    if (['--email', '--emails-file', '--project', '--database'].includes(token)) {
      index += 1;
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

function createAdminApp(projectId) {
  if (getApps().length) return getApps()[0];

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = loadJson(serviceAccountPath);
    return initializeApp({
      credential: cert(serviceAccount),
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

function describeRun({ projectId, databaseId, dryRun, allUsers, allNonAdmin, emails }) {
  console.log(`Project: ${projectId}`);
  console.log(`Firestore database: ${databaseId || '(default)'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  if (allUsers) {
    console.log('Target: all Firestore user documents');
    return;
  }
  if (allNonAdmin) {
    console.log('Target: all non-admin Firestore user documents');
    return;
  }
  console.log(`Target emails: ${emails.join(', ') || '(none)'}`);
}

async function fetchTargetDocs(db, { allUsers, allNonAdmin, emails }) {
  const usersSnapshot = await db.collection('users').get();
  const allDocs = usersSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  if (allUsers) return allDocs;
  if (allNonAdmin) return allDocs.filter((entry) => entry.role !== 'admin');

  const emailSet = new Set(emails);
  return allDocs.filter((entry) => emailSet.has(String(entry.email || '').toLowerCase()));
}

function buildProfileBackfill(existingProfile, userDoc) {
  const update = { uid: userDoc.uid || userDoc.id };

  for (const field of LEGACY_PROFILE_FIELDS) {
    if (existingProfile?.[field] === undefined && userDoc[field] !== undefined) {
      update[field] = userDoc[field];
    }
  }

  if (update.updatedAt === undefined) {
    update.updatedAt = new Date().toISOString();
  }

  return update;
}

function buildLegacyDeletes(userDoc) {
  const deletes = {};
  for (const field of LEGACY_PROFILE_FIELDS) {
    if (userDoc[field] !== undefined) {
      deletes[field] = FieldValue.delete();
    }
  }
  if (Object.keys(deletes).length > 0) {
    deletes.updatedAt = new Date().toISOString();
  }
  return deletes;
}

async function runCleanup(db, docs, dryRun) {
  let migratedProfiles = 0;
  let cleanedUsers = 0;

  for (const entry of docs) {
    const profileRef = db.collection('user_profiles').doc(entry.id);
    const userRef = db.collection('users').doc(entry.id);
    const profileSnapshot = await profileRef.get();
    const existingProfile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
    const profileBackfill = buildProfileBackfill(existingProfile, entry);
    const legacyDeletes = buildLegacyDeletes(entry);

    const willWriteProfile = Object.keys(profileBackfill).some((key) => key !== 'uid' && key !== 'updatedAt');
    const willCleanUser = Object.keys(legacyDeletes).length > 0;

    if (!willWriteProfile && !willCleanUser) {
      continue;
    }

    console.log(
      `${dryRun ? '[dry-run] would migrate' : 'migrating'} ${entry.id} (${entry.email || 'no-email'})` +
      `${willWriteProfile ? ' [profile]' : ''}` +
      `${willCleanUser ? ' [user-cleanup]' : ''}`
    );

    if (!dryRun) {
      const batch = db.batch();
      if (willWriteProfile) {
        batch.set(profileRef, profileBackfill, { merge: true });
      }
      if (willCleanUser) {
        batch.update(userRef, legacyDeletes);
      }
      await batch.commit();
    }

    if (willWriteProfile) migratedProfiles += 1;
    if (willCleanUser) cleanedUsers += 1;
  }

  return { migratedProfiles, cleanedUsers };
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

  const targetDocs = await fetchTargetDocs(db, {
    allUsers: cliArgs.allUsers,
    allNonAdmin: cliArgs.allNonAdmin,
    emails,
  });

  if (!targetDocs.length) {
    console.log('No matching Firestore user documents found.');
    return;
  }

  console.log(`Matched ${targetDocs.length} Firestore user document(s).`);
  const result = await runCleanup(db, targetDocs, cliArgs.dryRun);
  console.log(
    `${cliArgs.dryRun ? 'Dry run complete' : 'Cleanup complete'}: ` +
    `${result.migratedProfiles} profile doc(s) backfilled, ${result.cleanedUsers} user doc(s) stripped.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
