import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const args = {
    allNonAdmin: false,
    dryRun: false,
    emails: [],
    emailsFile: '',
    projectId: '',
    databaseId: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--all-non-admin') args.allNonAdmin = true;
    else if (token === '--dry-run') args.dryRun = true;
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

function getDatabase(dbApp, databaseId) {
  return databaseId && databaseId !== '(default)'
    ? getFirestore(dbApp, databaseId)
    : getFirestore(dbApp);
}

function describeTargeting({ allNonAdmin, emails, dryRun, projectId, databaseId }) {
  console.log(`Project: ${projectId}`);
  console.log(`Firestore database: ${databaseId || '(default)'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'DELETE'}`);
  if (allNonAdmin) {
    console.log('Target: all non-admin Firestore user documents');
  } else {
    console.log(`Target emails: ${emails.join(', ') || '(none)'}`);
  }
}

async function fetchTargetDocs(db, { allNonAdmin, emails }) {
  const usersSnapshot = await db.collection('users').get();
  const allDocs = usersSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  if (allNonAdmin) {
    return allDocs.filter((entry) => entry.role !== 'admin');
  }

  const emailSet = new Set(emails);
  return allDocs.filter((entry) => emailSet.has(String(entry.email || '').toLowerCase()));
}

async function deleteFirestoreDocs(db, docs, dryRun) {
  for (const entry of docs) {
    console.log(`${dryRun ? '[dry-run] would delete' : 'deleting'} Firestore user doc ${entry.id} (${entry.email || 'no-email'})`);
    if (!dryRun) {
      await db.collection('users').doc(entry.id).delete();
    }
  }
}

async function deleteAuthUsers(auth, docs, dryRun) {
  for (const entry of docs) {
    const candidateEmail = String(entry.email || '').trim();

    try {
      if (candidateEmail) {
        const authUser = await auth.getUserByEmail(candidateEmail);
        console.log(`${dryRun ? '[dry-run] would delete' : 'deleting'} Auth user ${authUser.uid} (${candidateEmail})`);
        if (!dryRun) {
          await auth.deleteUser(authUser.uid);
        }
        continue;
      }

      if (entry.id) {
        const authUser = await auth.getUser(entry.id);
        console.log(`${dryRun ? '[dry-run] would delete' : 'deleting'} Auth user ${authUser.uid} (matched by uid)`);
        if (!dryRun) {
          await auth.deleteUser(authUser.uid);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping Auth delete for ${candidateEmail || entry.id}: ${message}`);
    }
  }
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2));
  const firebaseConfig = loadJson(path.join(repoRoot, 'firebase-applet-config.json'));
  const projectId = cliArgs.projectId || firebaseConfig.projectId;
  const databaseId = cliArgs.databaseId || firebaseConfig.firestoreDatabaseId || '(default)';
  const emails = [...new Set([...cliArgs.emails, ...loadEmailList(cliArgs.emailsFile)])];

  if (!cliArgs.allNonAdmin && emails.length === 0) {
    console.error('Provide --all-non-admin or at least one --email / --emails-file.');
    process.exit(1);
  }

  describeTargeting({
    allNonAdmin: cliArgs.allNonAdmin,
    emails,
    dryRun: cliArgs.dryRun,
    projectId,
    databaseId,
  });

  const app = createAdminApp(projectId);
  const db = getDatabase(app, databaseId);
  const auth = getAuth(app);

  const targetDocs = await fetchTargetDocs(db, {
    allNonAdmin: cliArgs.allNonAdmin,
    emails,
  });

  if (!targetDocs.length) {
    console.log('No matching Firestore user documents found.');
    return;
  }

  console.log(`Matched ${targetDocs.length} Firestore user document(s).`);
  await deleteFirestoreDocs(db, targetDocs, cliArgs.dryRun);
  await deleteAuthUsers(auth, targetDocs, cliArgs.dryRun);
  console.log(cliArgs.dryRun ? 'Dry run complete.' : 'Purge complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
