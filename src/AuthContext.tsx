import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { auth, db, uploadDataUrlToStorage } from './firebase';
import { sendContractorNotification } from './lib/contractorNotifications';
import { authorizedApiFetch } from './lib/authorizedApi';
import {
  extractLegacyProfilePayload,
  getDerivedSubscriptionLevel,
  getDerivedTrialFields,
  getInitialsAvatar,
  mergeUserDocuments,
  stripUndefinedFields,
  USER_PROFILES_COLLECTION,
  USERS_COLLECTION,
} from './lib/userDocuments';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  getDocFromServer,
  collection,
  writeBatch
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

function isPermissionDeniedError(error: unknown) {
  if (!error) return false;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: string }).code === 'permission-denied';
  }
  if (error instanceof Error) {
    return error.message.includes('permission-denied') || error.message.includes('Missing or insufficient permissions');
  }
  return false;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (role?: UserRole) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    profile?: {
      phone?: string;
      street?: string;
      town?: string;
      zip?: string;
      governmentIdImage?: string;
      licenseNumber?: string;
      avatar?: string;
      isTradesman?: boolean;
      trade?: string;
      notifyOnProductUpdates?: boolean;
      notifyOnSmsLeadAlerts?: boolean;
      leadCategories?: string[];
    }
  ) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MISSING_ACCOUNT_NOTICE =
  'This account is no longer active in Blueprint Home Solutions. Contact admin if you need access restored.';
const PENDING_PUBLIC_SUBMISSIONS_KEY = 'blueprint_pending_public_submissions';
const AUTH_ROLE_HINTS_KEY = 'blueprint_auth_role_hints';
const EMAIL_WARNING_NOTICE_KEY = 'blueprint_email_warning_notice';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getUserDocWithRetry(userId: string, attempts = 8, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists()) {
      return userDoc;
    }

    if (attempt < attempts - 1) {
      await wait(delayMs);
    }
  }

  return null;
}

type PendingPublicSubmission = {
  leadId: string;
  email: string;
  name: string;
  phone: string;
  category: string;
  description: string;
  startDate: string;
  location: {
    street: string;
    town: string;
    zip: string;
  };
  photoCount: number;
  photos: string[];
  createdAt: string;
};

function loadPendingPublicSubmissions() {
  try {
    const raw = localStorage.getItem(PENDING_PUBLIC_SUBMISSIONS_KEY);
    if (!raw) return [] as PendingPublicSubmission[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingPublicSubmission[] : [];
  } catch {
    return [] as PendingPublicSubmission[];
  }
}

function savePendingPublicSubmissions(submissions: PendingPublicSubmission[]) {
  localStorage.setItem(PENDING_PUBLIC_SUBMISSIONS_KEY, JSON.stringify(submissions));
}

function loadCachedBlueprintUser() {
  try {
    const raw = localStorage.getItem('blueprint_user');
    if (!raw) return null;
    return JSON.parse(raw) as Partial<User>;
  } catch {
    return null;
  }
}

function loadAuthRoleHints() {
  try {
    const raw = localStorage.getItem(AUTH_ROLE_HINTS_KEY);
    if (!raw) return {} as Record<string, UserRole>;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, UserRole>) : {};
  } catch {
    return {} as Record<string, UserRole>;
  }
}

function getAuthRoleHint(email: string | null | undefined) {
  if (!email) return undefined;
  const hints = loadAuthRoleHints();
  return hints[email.trim().toLowerCase()];
}

function saveAuthRoleHint(email: string | null | undefined, role: UserRole | undefined) {
  if (!email || !role) return;
  const normalizedEmail = email.trim().toLowerCase();
  const hints = loadAuthRoleHints();
  hints[normalizedEmail] = role;
  localStorage.setItem(AUTH_ROLE_HINTS_KEY, JSON.stringify(hints));
}

function buildRecoveredUserFromAuth(firebaseUser: FirebaseUser) {
  const cachedUser = loadCachedBlueprintUser();
  const hintedRole = getAuthRoleHint(firebaseUser.email);
  const cachedMatchesIdentity =
    cachedUser?.id === firebaseUser.uid &&
    cachedUser?.email &&
    firebaseUser.email &&
    cachedUser.email.trim().toLowerCase() === firebaseUser.email.trim().toLowerCase();

  const role = hintedRole || (cachedMatchesIdentity && cachedUser?.role ? cachedUser.role : 'Homeowner');
  const createdAt = new Date().toISOString();
  const avatar =
    (cachedMatchesIdentity && cachedUser?.avatar && !cachedUser.avatar.startsWith('data:image/svg+xml')
      ? cachedUser.avatar
      : undefined) ||
    firebaseUser.photoURL ||
    getInitialsAvatar(cachedUser?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User');

  const recoveredIsVerified =
    role === 'Contractor'
      ? false
      : cachedMatchesIdentity
        ? (cachedUser?.isVerified ?? false)
        : false;

  const recoveredUser: User = {
    id: firebaseUser.uid,
    name: (cachedMatchesIdentity && cachedUser?.name) || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    email: firebaseUser.email || '',
    role,
    phone: cachedMatchesIdentity ? cachedUser?.phone : undefined,
    street: cachedMatchesIdentity ? cachedUser?.street : undefined,
    town: cachedMatchesIdentity ? cachedUser?.town : undefined,
    zip: cachedMatchesIdentity ? cachedUser?.zip : undefined,
    governmentIdImage: cachedMatchesIdentity ? cachedUser?.governmentIdImage : undefined,
    avatar,
    rating: role === 'Contractor' ? 4.9 : undefined,
    isVerified: recoveredIsVerified,
    licenseNumber: cachedMatchesIdentity ? cachedUser?.licenseNumber : undefined,
    licenseStatus: cachedMatchesIdentity ? cachedUser?.licenseStatus : undefined,
    isTradesman: cachedMatchesIdentity ? cachedUser?.isTradesman : undefined,
    trade: cachedMatchesIdentity ? cachedUser?.trade : undefined,
    leadCategories: cachedMatchesIdentity ? cachedUser?.leadCategories : undefined,
    subscriptionLevel: cachedMatchesIdentity && cachedUser?.subscriptionLevel
      ? cachedUser.subscriptionLevel
      : getDerivedSubscriptionLevel(role, createdAt),
    notifyOnNewProjects: cachedMatchesIdentity ? (cachedUser?.notifyOnNewProjects ?? (role === 'Contractor')) : (role === 'Contractor'),
    notifyOnRoughEstimates: cachedMatchesIdentity ? (cachedUser?.notifyOnRoughEstimates ?? (role === 'Homeowner')) : (role === 'Homeowner'),
    notifyOnProductUpdates: cachedMatchesIdentity ? (cachedUser?.notifyOnProductUpdates ?? (role === 'Contractor')) : (role === 'Contractor'),
    notifyOnSmsLeadAlerts: cachedMatchesIdentity ? (cachedUser?.notifyOnSmsLeadAlerts ?? false) : false,
    smsConsentAt: cachedMatchesIdentity ? cachedUser?.smsConsentAt : undefined,
    ...getDerivedTrialFields(role, createdAt),
  };

  return { recoveredUser, createdAt };
}

async function writeUserDocWithRecovery(
  userId: string,
  data: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    street?: string;
    town?: string;
    zip?: string;
    governmentIdImage?: string;
    avatar?: string;
    isVerified?: boolean;
    isDisabled?: boolean;
    licenseNumber?: User['licenseNumber'];
    licenseStatus?: User['licenseStatus'];
    isTradesman?: boolean;
    trade?: string;
    leadCategories?: string[];
    subscriptionLevel?: User['subscriptionLevel'];
    notifyOnNewProjects?: boolean;
    notifyOnRoughEstimates?: boolean;
    notifyOnProductUpdates?: boolean;
    notifyOnSmsLeadAlerts?: boolean;
    smsConsentAt?: string;
    accountPlan?: User['accountPlan'];
    trialStartedAt?: string;
    trialEndsAt?: string;
    createdAt?: string;
    updatedAt?: string;
  }
) {
  try {
    const response = await authorizedApiFetch('/api/sync-auth-user', {
      method: 'POST',
      body: JSON.stringify({ ...data, uid: userId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to sync user record');
    }
  } catch (error) {
    console.error('[AuthContext] Server-side user sync failed.', error);
    throw error;
  }
}

async function getMergedUserDoc(userId: string, firebaseUser: FirebaseUser) {
  const [accountDoc, profileDoc] = await Promise.all([
    getDoc(doc(db, USERS_COLLECTION, userId)),
    getDoc(doc(db, USER_PROFILES_COLLECTION, userId)),
  ]);

  const accountData = accountDoc.exists() ? accountDoc.data() : null;
  const profileData = profileDoc.exists() ? profileDoc.data() : null;

  if (!profileDoc.exists() && accountData) {
    const legacyProfilePayload = extractLegacyProfilePayload(userId, accountData as Partial<User>);
    const hasLegacyProfileFields = Object.keys(legacyProfilePayload).some((key) => key !== 'uid');

    if (hasLegacyProfileFields) {
      console.warn('[AuthContext] Legacy profile fields still live on users doc; profile backfill requires server migration.');
    }
  }

  return {
    accountData,
    profileData: profileData || (accountData ? extractLegacyProfilePayload(userId, accountData as Partial<User>) : null),
    exists: !!accountData,
  };
}

async function sendSignupConfirmationEmail({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role: UserRole;
}) {
  if (role === 'Contractor') {
    await sendContractorNotification({
      eventType: 'signup_confirmation',
      contractorEmail: email,
      contractorName: name,
    });
    return;
  }

  const response = await fetch('/api/send-welcome-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, role }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || response.statusText || 'Signup email request failed');
  }
}

async function resolveProfileMediaUrls(
  userId: string,
  media: {
    avatar?: string;
    governmentIdImage?: string;
  }
) {
  const nextMedia = { ...media };

  if (nextMedia.avatar?.startsWith('data:image')) {
    nextMedia.avatar = await uploadDataUrlToStorage(nextMedia.avatar, `profiles/${userId}/avatar.jpg`);
  }

  if (nextMedia.governmentIdImage?.startsWith('data:image')) {
    nextMedia.governmentIdImage = await uploadDataUrlToStorage(
      nextMedia.governmentIdImage,
      `profiles/${userId}/government-id.jpg`
    );
  }

  return nextMedia;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const claimPendingPublicSubmissions = async (nextUser: User) => {
    if (nextUser.role !== 'Homeowner') return;

    const pendingSubmissions = loadPendingPublicSubmissions();
    if (pendingSubmissions.length === 0) return;

    const matchingSubmissions = pendingSubmissions.filter(
      (submission) => submission.email.trim().toLowerCase() === nextUser.email.trim().toLowerCase()
    );

    if (matchingSubmissions.length === 0) return;

    for (const submission of matchingSubmissions) {
      const projectRef = doc(db, 'projects', submission.leadId);
      const projectSnapshot = await getDoc(projectRef);
      if (projectSnapshot.exists()) {
        continue;
      }

      const batch = writeBatch(db);
      batch.set(projectRef, {
        uid: nextUser.id,
        title: submission.category || 'General Project',
        description: submission.description,
        status: 'New Open Project',
        budget: 0,
        startDate: submission.startDate,
        category: submission.category,
        phone: submission.phone,
        location: submission.location,
        photoCount: submission.photoCount,
        photos: submission.photos.slice(0, 3),
        services: submission.category ? [submission.category] : ['General'],
        createdAt: submission.createdAt,
        updatedAt: new Date().toISOString(),
      });

      submission.photos.forEach((url, index) => {
        const photoRef = doc(collection(db, 'projects', submission.leadId, 'photos'));
        batch.set(photoRef, {
          url,
          createdAt: new Date(new Date(submission.createdAt).getTime() + index).toISOString(),
          uid: nextUser.id,
        });
      });

      await batch.commit();
      try {
        await authorizedApiFetch('/api/update-user-profile', {
          method: 'POST',
          body: JSON.stringify({
            name: nextUser.name,
            phone: nextUser.phone || submission.phone,
            street: nextUser.street || submission.location.street,
            town: nextUser.town || submission.location.town,
            zip: nextUser.zip || submission.location.zip,
            avatar: nextUser.avatar,
            notifyOnRoughEstimates: nextUser.notifyOnRoughEstimates ?? true,
            notifyOnProductUpdates: nextUser.notifyOnProductUpdates ?? false,
          }),
        });
      } catch (profileSyncError) {
        console.error('Failed to sync claimed homeowner profile fields:', profileSyncError);
      }
    }

    const remainingSubmissions = pendingSubmissions.filter(
      (submission) => submission.email.trim().toLowerCase() !== nextUser.email.trim().toLowerCase()
    );
    savePendingPublicSubmissions(remainingSubmissions);
  };

  useEffect(() => {
    // Validate connection to Firestore on boot
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const { accountData, profileData, exists } = await getMergedUserDoc(firebaseUser.uid, firebaseUser);
          if (exists && accountData) {
            const isAdminEmail = firebaseUser.email?.toLowerCase() === 'blaztprod@gmail.com';
            const mergedAccountData = isAdminEmail
              ? { ...accountData, role: 'admin' as const }
              : accountData;

            const userData = mergeUserDocuments({
              userId: firebaseUser.uid,
              email: firebaseUser.email || '',
              authDisplayName: firebaseUser.displayName,
              authPhotoURL: firebaseUser.photoURL,
              account: mergedAccountData,
              profile: profileData,
            });
            setUser(userData);
            localStorage.setItem('blueprint_user', JSON.stringify(userData));
            saveAuthRoleHint(userData.email, userData.role);
            await claimPendingPublicSubmissions(userData);
          } else {
            const { recoveredUser, createdAt } = buildRecoveredUserFromAuth(firebaseUser);
            await writeUserDocWithRecovery(firebaseUser.uid, {
              email: recoveredUser.email,
              name: recoveredUser.name,
              role: recoveredUser.role,
              phone: recoveredUser.phone,
              street: recoveredUser.street,
              town: recoveredUser.town,
              zip: recoveredUser.zip,
              governmentIdImage: recoveredUser.governmentIdImage,
              avatar: recoveredUser.avatar,
              isVerified: recoveredUser.isVerified ?? false,
              licenseNumber: recoveredUser.licenseNumber,
              licenseStatus: recoveredUser.licenseStatus,
              isTradesman: recoveredUser.isTradesman,
              trade: recoveredUser.trade,
              leadCategories: recoveredUser.leadCategories,
              subscriptionLevel: recoveredUser.subscriptionLevel || getDerivedSubscriptionLevel(recoveredUser.role, createdAt),
              notifyOnNewProjects: recoveredUser.notifyOnNewProjects,
              notifyOnRoughEstimates: recoveredUser.notifyOnRoughEstimates,
              notifyOnProductUpdates: recoveredUser.notifyOnProductUpdates,
              notifyOnSmsLeadAlerts: recoveredUser.notifyOnSmsLeadAlerts,
              smsConsentAt: recoveredUser.smsConsentAt,
              accountPlan: recoveredUser.accountPlan,
              trialStartedAt: recoveredUser.trialStartedAt,
              trialEndsAt: recoveredUser.trialEndsAt,
              createdAt,
              updatedAt: new Date().toISOString(),
            });

            setUser(recoveredUser);
            localStorage.setItem('blueprint_user', JSON.stringify(recoveredUser));
            saveAuthRoleHint(recoveredUser.email, recoveredUser.role);
            await claimPendingPublicSubmissions(recoveredUser);
          }
        } else {
          setUser(null);
          localStorage.removeItem('blueprint_user');
        }
      } catch (error) {
        console.error('Auth state initialization failed:', error);

        if (firebaseUser) {
          const cachedUser = loadCachedBlueprintUser();
          const hintedRole = getAuthRoleHint(firebaseUser.email);
          const fallbackRole = hintedRole || 'Homeowner';
          const createdAt = firebaseUser.metadata.creationTime || new Date().toISOString();
          const fallbackUser: User = {
            id: firebaseUser.uid,
            name:
              (cachedUser?.id === firebaseUser.uid && cachedUser.name) ||
              firebaseUser.displayName ||
              firebaseUser.email?.split('@')[0] ||
              'User',
            email: firebaseUser.email || '',
            role:
              cachedUser?.id === firebaseUser.uid && cachedUser.role
                ? cachedUser.role
                : fallbackRole,
            phone: cachedUser?.id === firebaseUser.uid ? cachedUser.phone : undefined,
            street: cachedUser?.id === firebaseUser.uid ? cachedUser.street : undefined,
            town: cachedUser?.id === firebaseUser.uid ? cachedUser.town : undefined,
            zip: cachedUser?.id === firebaseUser.uid ? cachedUser.zip : undefined,
            governmentIdImage: cachedUser?.id === firebaseUser.uid ? cachedUser.governmentIdImage : undefined,
            avatar:
              (cachedUser?.id === firebaseUser.uid && cachedUser.avatar) ||
              firebaseUser.photoURL ||
              getInitialsAvatar(
                (cachedUser?.id === firebaseUser.uid && cachedUser.name) ||
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'User'
              ),
            rating:
              ((cachedUser?.id === firebaseUser.uid ? cachedUser.role : fallbackRole) === 'Contractor') ? 4.9 : undefined,
            isVerified: cachedUser?.id === firebaseUser.uid ? (cachedUser.isVerified ?? false) : false,
            licenseNumber: cachedUser?.id === firebaseUser.uid ? cachedUser.licenseNumber : undefined,
            licenseStatus: cachedUser?.id === firebaseUser.uid ? cachedUser.licenseStatus : undefined,
            isTradesman: cachedUser?.id === firebaseUser.uid ? cachedUser.isTradesman : undefined,
            trade: cachedUser?.id === firebaseUser.uid ? cachedUser.trade : undefined,
            leadCategories: cachedUser?.id === firebaseUser.uid ? cachedUser.leadCategories : undefined,
            subscriptionLevel:
              (cachedUser?.id === firebaseUser.uid && cachedUser.subscriptionLevel) ||
              getDerivedSubscriptionLevel(
                (cachedUser?.id === firebaseUser.uid && cachedUser.role) || fallbackRole,
                createdAt
              ),
            notifyOnNewProjects:
              cachedUser?.id === firebaseUser.uid
                ? (cachedUser.notifyOnNewProjects ?? (((cachedUser.role || fallbackRole) === 'Contractor')))
                : fallbackRole === 'Contractor',
            notifyOnRoughEstimates:
              cachedUser?.id === firebaseUser.uid
                ? (cachedUser.notifyOnRoughEstimates ?? (((cachedUser.role || fallbackRole) === 'Homeowner')))
                : fallbackRole === 'Homeowner',
            notifyOnProductUpdates: cachedUser?.id === firebaseUser.uid ? (cachedUser.notifyOnProductUpdates ?? (fallbackRole === 'Contractor')) : fallbackRole === 'Contractor',
            notifyOnSmsLeadAlerts: cachedUser?.id === firebaseUser.uid ? (cachedUser.notifyOnSmsLeadAlerts ?? false) : false,
            smsConsentAt: cachedUser?.id === firebaseUser.uid ? cachedUser.smsConsentAt : undefined,
            accountPlan:
              (cachedUser?.id === firebaseUser.uid && cachedUser.accountPlan) ||
              getDerivedTrialFields((cachedUser?.id === firebaseUser.uid && cachedUser.role) || fallbackRole, createdAt).accountPlan,
            trialStartedAt:
              (cachedUser?.id === firebaseUser.uid && cachedUser.trialStartedAt) ||
              getDerivedTrialFields((cachedUser?.id === firebaseUser.uid && cachedUser.role) || fallbackRole, createdAt).trialStartedAt,
            trialEndsAt:
              (cachedUser?.id === firebaseUser.uid && cachedUser.trialEndsAt) ||
              getDerivedTrialFields((cachedUser?.id === firebaseUser.uid && cachedUser.role) || fallbackRole, createdAt).trialEndsAt,
          };

          setUser(fallbackUser);
          localStorage.setItem('blueprint_user', JSON.stringify(fallbackUser));
          saveAuthRoleHint(fallbackUser.email, fallbackUser.role);
        } else {
          setUser(null);
          localStorage.removeItem('blueprint_user');
        }
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getUserDocWithRetry(userCredential.user.uid, 2, 150);

      if (!userDoc) {
        const { recoveredUser, createdAt } = buildRecoveredUserFromAuth(userCredential.user);
        await writeUserDocWithRecovery(userCredential.user.uid, {
          email: recoveredUser.email,
          name: recoveredUser.name,
          role: recoveredUser.role,
          phone: recoveredUser.phone,
          street: recoveredUser.street,
          town: recoveredUser.town,
          zip: recoveredUser.zip,
          governmentIdImage: recoveredUser.governmentIdImage,
          avatar: recoveredUser.avatar,
          isVerified: recoveredUser.isVerified ?? false,
          licenseNumber: recoveredUser.licenseNumber,
          licenseStatus: recoveredUser.licenseStatus,
          isTradesman: recoveredUser.isTradesman,
          trade: recoveredUser.trade,
          leadCategories: recoveredUser.leadCategories,
          subscriptionLevel: recoveredUser.subscriptionLevel || getDerivedSubscriptionLevel(recoveredUser.role, createdAt),
          notifyOnNewProjects: recoveredUser.notifyOnNewProjects,
          notifyOnRoughEstimates: recoveredUser.notifyOnRoughEstimates,
          notifyOnProductUpdates: recoveredUser.notifyOnProductUpdates,
          notifyOnSmsLeadAlerts: recoveredUser.notifyOnSmsLeadAlerts,
          smsConsentAt: recoveredUser.smsConsentAt,
          accountPlan: recoveredUser.accountPlan,
          trialStartedAt: recoveredUser.trialStartedAt,
          trialEndsAt: recoveredUser.trialEndsAt,
          createdAt,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (requestedRole?: UserRole) => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;
      
      // Check if user doc exists, if not create it with a default role
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid));
      if (!userDoc.exists()) {
        const isAdminEmail = firebaseUser.email?.toLowerCase() === 'blaztprod@gmail.com';
        const role: UserRole = isAdminEmail ? 'admin' : (requestedRole || 'Homeowner');
      saveAuthRoleHint(firebaseUser.email, role);
      await writeUserDocWithRecovery(firebaseUser.uid, {
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || 'User',
        role,
        avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
        isVerified: false,
        subscriptionLevel: getDerivedSubscriptionLevel(role),
        notifyOnProductUpdates: role === 'Contractor',
        notifyOnSmsLeadAlerts: false,
        leadCategories: [],
        accountPlan: getDerivedTrialFields(role).accountPlan,
        trialStartedAt: getDerivedTrialFields(role).trialStartedAt,
        trialEndsAt: getDerivedTrialFields(role).trialEndsAt,
        createdAt: new Date().toISOString(),
      });
        
        const userData: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          role: role,
          avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
          isVerified: false,
        subscriptionLevel: getDerivedSubscriptionLevel(role),
        notifyOnNewProjects: role === 'Contractor',
        notifyOnRoughEstimates: role === 'Homeowner',
        notifyOnProductUpdates: role === 'Contractor',
        notifyOnSmsLeadAlerts: false,
        leadCategories: [],
        ...getDerivedTrialFields(role),
        };
        setUser(userData);
        localStorage.setItem('blueprint_user', JSON.stringify(userData));
        saveAuthRoleHint(userData.email, userData.role);
        await claimPendingPublicSubmissions(userData);

        // Send signup confirmation email
      try {
        console.log(`[AuthContext] Attempting to send signup confirmation email to ${firebaseUser.email}...`);
        await sendSignupConfirmationEmail({
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'User',
          role,
        });
      } catch (emailError) {
        console.error("[AuthContext] Failed to send signup confirmation email:", emailError);
        sessionStorage.setItem(
          EMAIL_WARNING_NOTICE_KEY,
          'Your account was created, but Blueprint could not send the signup confirmation email. Check your email settings or Netlify function logs.'
        );
      }
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    profile?: {
      phone?: string;
      street?: string;
      town?: string;
      zip?: string;
      governmentIdImage?: string;
      licenseNumber?: string;
      avatar?: string;
      isTradesman?: boolean;
      trade?: string;
      notifyOnProductUpdates?: boolean;
      notifyOnSmsLeadAlerts?: boolean;
      leadCategories?: string[];
    }
  ) => {
    const nextProfile = profile || {};
    const smsConsentAt = nextProfile.notifyOnSmsLeadAlerts ? new Date().toISOString() : undefined;
    try {
      saveAuthRoleHint(email, role);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const uploadedMedia = await resolveProfileMediaUrls(firebaseUser.uid, {
        avatar: nextProfile.avatar,
        governmentIdImage: nextProfile.governmentIdImage,
      });
      const finalAvatar = uploadedMedia.avatar || getInitialsAvatar(name);

      const isAdminEmail = email.toLowerCase() === 'blaztprod@gmail.com';
      const finalRole = isAdminEmail ? 'admin' : role;
      
      const userData: User = {
        id: firebaseUser.uid,
        name: name,
        email: email,
        role: finalRole,
        phone: nextProfile.phone,
        street: nextProfile.street,
        town: nextProfile.town,
        zip: nextProfile.zip,
        avatar: finalAvatar,
        rating: finalRole === 'Contractor' ? 4.9 : undefined,
        isVerified: false,
        governmentIdImage: finalRole === 'Contractor' ? uploadedMedia.governmentIdImage : undefined,
        licenseNumber: finalRole === 'Contractor' ? nextProfile.licenseNumber : undefined,
        licenseStatus: finalRole === 'Contractor' ? 'Pending' : undefined,
        isTradesman: finalRole === 'Contractor' ? nextProfile.isTradesman : undefined,
        trade: finalRole === 'Contractor' ? nextProfile.trade : undefined,
        leadCategories: finalRole === 'Contractor' ? (nextProfile.leadCategories ?? []) : undefined,
        subscriptionLevel: getDerivedSubscriptionLevel(finalRole),
        notifyOnNewProjects: finalRole === 'Contractor',
        notifyOnRoughEstimates: finalRole === 'Homeowner',
        notifyOnProductUpdates: nextProfile.notifyOnProductUpdates ?? false,
        notifyOnSmsLeadAlerts: finalRole === 'Contractor' ? (nextProfile.notifyOnSmsLeadAlerts ?? false) : false,
        smsConsentAt: finalRole === 'Contractor' ? smsConsentAt : undefined,
        ...getDerivedTrialFields(finalRole),
      };

      // Set user in state first to avoid fallback issues in onAuthStateChanged
      setUser(userData);
      localStorage.setItem('blueprint_user', JSON.stringify(userData));
      saveAuthRoleHint(userData.email, userData.role);
      await claimPendingPublicSubmissions(userData);

      await writeUserDocWithRecovery(firebaseUser.uid, {
        email,
        name,
        role: finalRole,
        phone: nextProfile.phone,
        street: nextProfile.street,
        town: nextProfile.town,
        zip: nextProfile.zip,
        avatar: finalAvatar,
        isVerified: false,
        governmentIdImage: finalRole === 'Contractor' ? uploadedMedia.governmentIdImage : undefined,
        licenseNumber: finalRole === 'Contractor' ? nextProfile.licenseNumber : undefined,
        licenseStatus: finalRole === 'Contractor' ? 'Pending' : undefined,
        isTradesman: finalRole === 'Contractor' ? nextProfile.isTradesman : undefined,
        trade: finalRole === 'Contractor' ? nextProfile.trade : undefined,
        leadCategories: userData.leadCategories,
        subscriptionLevel: getDerivedSubscriptionLevel(finalRole),
        notifyOnNewProjects: userData.notifyOnNewProjects,
        notifyOnRoughEstimates: userData.notifyOnRoughEstimates,
        notifyOnProductUpdates: userData.notifyOnProductUpdates,
        notifyOnSmsLeadAlerts: userData.notifyOnSmsLeadAlerts,
        smsConsentAt: userData.smsConsentAt,
        accountPlan: userData.accountPlan,
        trialStartedAt: userData.trialStartedAt,
        trialEndsAt: userData.trialEndsAt,
        createdAt: new Date().toISOString(),
      });

      // Send signup confirmation email
      try {
        console.log(`[AuthContext] Attempting to send signup confirmation email to ${email}...`);
        await sendSignupConfirmationEmail({
          email,
          name,
          role: finalRole,
        });
      } catch (emailError) {
        console.error("[AuthContext] Failed to send signup confirmation email:", emailError);
        sessionStorage.setItem(
          EMAIL_WARNING_NOTICE_KEY,
          'Your account was created, but Blueprint could not send the signup confirmation email. Check your email settings or Netlify function logs.'
        );
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error instanceof Error && error.message.includes('permission-denied')) {
        handleFirestoreError(error, OperationType.WRITE, `${USERS_COLLECTION}/${auth.currentUser?.uid}`);
      }
      throw error;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    try {
      const resolvedMedia = await resolveProfileMediaUrls(user.id, {
        avatar: data.avatar,
        governmentIdImage: data.governmentIdImage,
      });
      const updatedUser = {
        ...user,
        ...data,
        ...resolvedMedia,
        id: user.id,
        email: user.email,
        role: user.role,
      };
      const nextSmsOptIn =
        typeof data.notifyOnSmsLeadAlerts === 'boolean'
          ? data.notifyOnSmsLeadAlerts
          : updatedUser.notifyOnSmsLeadAlerts;
      updatedUser.smsConsentAt = nextSmsOptIn
        ? updatedUser.smsConsentAt || new Date().toISOString()
        : undefined;
      
      // If name changed but no avatar provided, update initials avatar if it was using initials
      if (data.name && !data.avatar && user.avatar?.startsWith('data:image/svg+xml')) {
        updatedUser.avatar = getInitialsAvatar(data.name);
      }

      const response = await authorizedApiFetch('/api/update-user-profile', {
        method: 'POST',
        body: JSON.stringify({
          name: updatedUser.name,
          phone: updatedUser.phone,
          street: updatedUser.street,
          town: updatedUser.town,
          zip: updatedUser.zip,
          governmentIdImage: updatedUser.governmentIdImage,
          avatar: updatedUser.avatar,
          licenseNumber: updatedUser.licenseNumber,
          isTradesman: updatedUser.isTradesman,
          trade: updatedUser.trade,
          leadCategories: updatedUser.leadCategories,
          notifyOnNewProjects: updatedUser.notifyOnNewProjects,
          notifyOnRoughEstimates: updatedUser.notifyOnRoughEstimates,
          notifyOnProductUpdates: updatedUser.notifyOnProductUpdates,
          notifyOnSmsLeadAlerts: updatedUser.notifyOnSmsLeadAlerts,
          smsConsentAt: updatedUser.smsConsentAt,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update profile');
      }

      setUser(updatedUser);
      localStorage.setItem('blueprint_user', JSON.stringify(updatedUser));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USER_PROFILES_COLLECTION}/${user.id}`);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Attempting to send password reset email to:', email);
      await sendPasswordResetEmail(auth, email);
      console.log('Password reset email sent successfully');
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, signup, updateProfile, resetPassword, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
