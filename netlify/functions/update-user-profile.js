import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { buildUserProfilePayload, getVerifiedRequestUser, USER_PROFILES_COLLECTION } from './_user-records.js';

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
    const updatedAt = new Date().toISOString();

    await adminDb.collection(USER_PROFILES_COLLECTION).doc(requestUser.uid).set(
      buildUserProfilePayload({
        uid: requestUser.uid,
        email: requestUser.email,
        name: payload.name,
        phone: payload.phone,
        street: payload.street,
        town: payload.town,
        zip: payload.zip,
        avatar: payload.avatar,
        governmentIdImage: payload.governmentIdImage,
        portfolioImages: payload.portfolioImages,
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
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, updatedAt }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update profile' }),
    };
  }
};
