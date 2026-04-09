import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { buildUserAccountPayload, getVerifiedRequestUser, USERS_COLLECTION } from './_user-records.js';

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
    if (!payload.userId || !payload.email || !payload.role) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId, email, and role are required' }) };
    }

    const existingSnapshot = await adminDb.collection(USERS_COLLECTION).doc(payload.userId).get();
    const existing = existingSnapshot.exists ? existingSnapshot.data() : {};

    await adminDb.collection(USERS_COLLECTION).doc(payload.userId).set(
      buildUserAccountPayload({
        uid: payload.userId,
        email: payload.email,
        role: payload.role,
        createdAt: payload.createdAt || existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDisabled: payload.isDisabled ?? existing.isDisabled ?? false,
        isVerified: payload.isVerified ?? existing.isVerified ?? false,
        licenseStatus: payload.licenseStatus ?? existing.licenseStatus,
        subscriptionLevel: payload.subscriptionLevel ?? existing.subscriptionLevel,
        accountPlan: payload.accountPlan ?? existing.accountPlan,
        trialStartedAt: payload.trialStartedAt ?? existing.trialStartedAt,
        trialEndsAt: payload.trialEndsAt ?? existing.trialEndsAt,
      }),
      { merge: true }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update user' }),
    };
  }
};
