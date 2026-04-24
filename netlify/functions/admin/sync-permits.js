import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { syncDobPermits } from '../_permit-sync.js';
import { getVerifiedRequestUser, USERS_COLLECTION } from '../_user-records.js';

const API_ENABLED_SUBSCRIPTION_LEVELS = new Set(['trial', 'beginner', 'junior', 'pro']);

function getAdminAppInstance() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'blueprint-home-solutions';
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath) {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  return initializeApp(
    clientEmail && privateKey
      ? {
          credential: cert({ projectId, clientEmail, privateKey }),
          projectId,
        }
      : {
          credential: applicationDefault(),
          projectId,
        }
  );
}

function getAdminDb() {
  return getAdminFirestore(getAdminAppInstance(), process.env.FIREBASE_FIRESTORE_DATABASE_ID || 'blueprinthomesolutionsdata');
}

async function getUserAccountByUid(uid) {
  if (!uid) return null;

  const snapshot = await getAdminDb().collection(USERS_COLLECTION).doc(uid).get().catch(() => null);
  return snapshot?.exists ? snapshot.data() : null;
}

async function requireSignedInUser(event) {
  const requestUser = await getVerifiedRequestUser({
    authorizationHeader: event.headers?.authorization || event.headers?.Authorization || '',
    adminAuth: getAdminAuth(getAdminAppInstance()),
    adminDb: getAdminDb(),
  });
  const userAccount = await getUserAccountByUid(requestUser.uid);

  return { requestUser, userAccount };
}

function hasApiSubscriptionAccess(userAccount, requestUser) {
  if (requestUser?.isAdmin) return true;
  if (!userAccount) return false;
  if (userAccount.role === 'admin') return true;

  return API_ENABLED_SUBSCRIPTION_LEVELS.has(String(userAccount.subscriptionLevel || ''));
}

async function requireSignedInApiManager(event) {
  const { requestUser, userAccount } = await requireSignedInUser(event);

  if (!hasApiSubscriptionAccess(userAccount, requestUser)) {
    const error = new Error('API access is not enabled for this account.');
    error.statusCode = 403;
    throw error;
  }

  return { requestUser, userAccount };
}

export const handler = async (event) => {
  if (event.httpMethod === 'GET') {
    try {
      await requireSignedInUser(event);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      };
    } catch (error) {
      const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to inspect permit sync status',
        }),
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    await requireSignedInUser(event);
    const payload = await syncDobPermits();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        message: 'Permit sync completed',
        meta: {
          source: 'supabase',
          count: payload.count,
          latestIssuedDate: payload.permits[0]?.filing_date || null,
          latestUpdatedAt: payload.generatedAt,
          filter: 'all',
        },
      }),
    };
  } catch (error) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Permit sync failed',
      }),
    };
  }
};
