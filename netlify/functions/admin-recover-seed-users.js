import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { buildUserAccountPayload, buildUserProfilePayload, getVerifiedRequestUser, RECOVERY_SEED_USERS, USERS_COLLECTION, USER_PROFILES_COLLECTION } from './_user-records.js';

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

    const batch = adminDb.batch();
    const updatedAt = new Date().toISOString();

    for (const seedUser of RECOVERY_SEED_USERS) {
      batch.set(
        adminDb.collection(USERS_COLLECTION).doc(seedUser.uid),
        buildUserAccountPayload({
          uid: seedUser.uid,
          email: seedUser.email,
          createdAt: seedUser.createdAt,
          updatedAt,
        }),
        { merge: true }
      );
      batch.set(
        adminDb.collection(USER_PROFILES_COLLECTION).doc(seedUser.uid),
        buildUserProfilePayload({
          uid: seedUser.uid,
          email: seedUser.email,
          updatedAt,
        }),
        { merge: true }
      );
    }

    await batch.commit();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, recovered: RECOVERY_SEED_USERS.length }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to recover seed users' }),
    };
  }
};
