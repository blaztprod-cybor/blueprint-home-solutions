import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection } from 'firebase/firestore';

const config = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url), 'utf8'));

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

const stamp = Date.now();
const email = `vivian.glen.test.${stamp}@example.com`;
const password = `Blueprint!${stamp}`;
const name = 'Vivian Glen Test';
const createdAt = new Date().toISOString();

const avatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%232563eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="38" font-weight="700" fill="white">VG</text></svg>';

const photo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="%23e0f2fe"/><rect x="110" y="120" width="980" height="560" rx="36" fill="%23ffffff" stroke="%230f172a" stroke-width="8"/><text x="600" y="300" text-anchor="middle" font-family="Arial" font-size="70" font-weight="700" fill="%230f172a">Test Kitchen Project</text><text x="600" y="390" text-anchor="middle" font-family="Arial" font-size="38" fill="%23475569">Seeded by Codex for portal verification</text><circle cx="320" cy="520" r="70" fill="%23f59e0b"/><rect x="430" y="470" width="430" height="110" rx="18" fill="%2393c5fd"/><rect x="890" y="450" width="90" height="160" rx="16" fill="%2334d399"/></svg>';

const credential = await createUserWithEmailAndPassword(auth, email, password);
const uid = credential.user.uid;

await setDoc(doc(db, 'users', uid), {
  uid,
  email,
  name,
  role: 'Homeowner',
  avatar,
  isVerified: false,
  createdAt
});

const projectRef = await addDoc(collection(db, 'projects'), {
  uid,
  title: 'TEST - Kitchen Remodel',
  description: 'Test homeowner project created to verify that new submissions thread from the Homeowner Portal into the Home Pro Portal project grid with a photo preview.',
  category: 'Kitchens',
  status: 'New Open Project',
  budget: 0,
  startDate: '2026-04-15',
  location: {
    street: '123 Test Lane',
    town: 'Brooklyn',
    zip: '11201'
  },
  phone: '(555) 010-2040',
  services: ['kitchens'],
  photoCount: 1,
  photos: [photo],
  createdAt
});

await addDoc(collection(db, 'projects', projectRef.id, 'photos'), {
  uid,
  url: photo,
  createdAt
});

console.log(JSON.stringify({
  email,
  password,
  uid,
  projectId: projectRef.id
}, null, 2));
