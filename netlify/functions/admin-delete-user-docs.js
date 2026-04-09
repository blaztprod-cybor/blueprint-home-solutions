import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { getVerifiedRequestUser, USER_PROFILES_COLLECTION, USERS_COLLECTION } from './_user-records.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const requestUser = await getVerifiedRequestUser({
      authorizationHeader: event.headers.authorization || event.headers.Authorization,
      adminAuth,
      adminDb,
    });

    if (!requestUser.isAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const payload = JSON.parse(event.body || '{}');
    if (!payload.userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    }

    await Promise.all([
      adminDb.collection(USERS_COLLECTION).doc(payload.userId).delete(),
      adminDb.collection(USER_PROFILES_COLLECTION).doc(payload.userId).delete(),
    ]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to delete user docs' }),
    };
  }
};
