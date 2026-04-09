import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { buildUserAccountPayload, buildUserProfilePayload, getVerifiedRequestUser, USER_PROFILES_COLLECTION, USERS_COLLECTION } from './_user-records.js';

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

    const payload = JSON.parse(event.body || '{}');
    const createdAt = payload.createdAt || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    await Promise.all([
      adminDb.collection(USERS_COLLECTION).doc(requestUser.uid).set(
        buildUserAccountPayload({
          uid: requestUser.uid,
          email: requestUser.email,
          role: payload.role,
          createdAt,
          updatedAt,
          isDisabled: payload.isDisabled,
          isVerified: payload.isVerified,
          licenseStatus: payload.licenseStatus,
          subscriptionLevel: payload.subscriptionLevel,
          accountPlan: payload.accountPlan,
          trialStartedAt: payload.trialStartedAt,
          trialEndsAt: payload.trialEndsAt,
        }),
        { merge: true }
      ),
      adminDb.collection(USER_PROFILES_COLLECTION).doc(requestUser.uid).set(
        buildUserProfilePayload({
          uid: requestUser.uid,
          email: requestUser.email,
          role: payload.role,
          name: payload.name,
          phone: payload.phone,
          street: payload.street,
          town: payload.town,
          zip: payload.zip,
          avatar: payload.avatar,
          governmentIdImage: payload.governmentIdImage,
          licenseNumber: payload.licenseNumber,
          isTradesman: payload.isTradesman,
          trade: payload.trade,
          leadCategories: payload.leadCategories,
          notifyOnNewProjects: payload.notifyOnNewProjects,
          notifyOnRoughEstimates: payload.notifyOnRoughEstimates,
          notifyOnProductUpdates: payload.notifyOnProductUpdates,
          notifyOnSmsLeadAlerts: payload.notifyOnSmsLeadAlerts,
          smsConsentAt: payload.smsConsentAt,
          updatedAt,
        }),
        { merge: true }
      ),
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to sync user' }),
    };
  }
};
