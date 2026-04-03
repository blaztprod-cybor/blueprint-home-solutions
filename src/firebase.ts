import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Respect the named database if it's provided in the config
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeStorageName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

const STORAGE_UPLOAD_TIMEOUT_MS = 20000;

export async function uploadFilesToStorage(
  files: File[],
  basePath: string
) {
  const uploadedUrls: string[] = [];

  for (const [index, file] of files.entries()) {
    const storageRef = ref(
      storage,
      `${basePath}/${Date.now()}-${index}-${sanitizeStorageName(file.name)}`
    );

    await withTimeout(
      uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      }),
      STORAGE_UPLOAD_TIMEOUT_MS,
      `Upload for ${file.name}`
    );

    uploadedUrls.push(
      await withTimeout(
        getDownloadURL(storageRef),
        STORAGE_UPLOAD_TIMEOUT_MS,
        `Download URL fetch for ${file.name}`
      )
    );
  }

  return uploadedUrls;
}

export default app;
