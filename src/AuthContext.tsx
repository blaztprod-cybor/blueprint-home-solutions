import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { auth, db, uploadDataUrlToStorage } from './firebase';
import { sendContractorNotification } from './lib/contractorNotifications';
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
  setDoc, 
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

function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedFields(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedFields(entry)])
    ) as T;
  }

  return value;
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
    const userDoc = await getDoc(doc(db, 'users', userId));
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

const getInitialsAvatar = (name: string) => {
  const names = name.split(' ');
  const initials = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#4F46E5', '#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706'];
  const color = colors[Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length];
  
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${color.replace('#', '%23')}" />
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white">${initials}</text>
  </svg>`;
};

const TRIAL_DURATION_DAYS = 14;

function getTrialWindow(startIso = new Date().toISOString()) {
  const trialStartedAt = new Date(startIso);
  const trialEndsAt = new Date(trialStartedAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

  return {
    trialStartedAt: trialStartedAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
  };
}

function getDerivedTrialFields(role: UserRole, createdAt?: string) {
  if (role !== 'Contractor') {
    return {
      accountPlan: 'standard' as const,
      trialStartedAt: undefined,
      trialEndsAt: undefined,
    };
  }

  const trialSource = createdAt || new Date().toISOString();
  const trialWindow = getTrialWindow(trialSource);

  return {
    accountPlan: 'trial' as const,
    trialStartedAt: trialWindow.trialStartedAt,
    trialEndsAt: trialWindow.trialEndsAt,
  };
}

function getDerivedSubscriptionLevel(role: UserRole, createdAt?: string) {
  if (role !== 'Contractor') return 'none' as const;

  if (!createdAt) return 'trial' as const;

  const trialEndsAt = new Date(getTrialWindow(createdAt).trialEndsAt).getTime();
  return trialEndsAt > Date.now() ? ('trial' as const) : ('none' as const);
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
    subscriptionLevel: cachedMatchesIdentity && cachedUser?.subscriptionLevel
      ? cachedUser.subscriptionLevel
      : getDerivedSubscriptionLevel(role, createdAt),
    notifyOnNewProjects: cachedMatchesIdentity ? (cachedUser?.notifyOnNewProjects ?? (role === 'Contractor')) : (role === 'Contractor'),
    notifyOnRoughEstimates: cachedMatchesIdentity ? (cachedUser?.notifyOnRoughEstimates ?? (role === 'Homeowner')) : (role === 'Homeowner'),
    notifyOnProductUpdates: cachedMatchesIdentity ? (cachedUser?.notifyOnProductUpdates ?? false) : false,
    notifyOnSmsLeadAlerts: cachedMatchesIdentity ? (cachedUser?.notifyOnSmsLeadAlerts ?? false) : false,
    smsConsentAt: cachedMatchesIdentity ? cachedUser?.smsConsentAt : undefined,
    ...getDerivedTrialFields(role, createdAt),
  };

  return { recoveredUser, createdAt };
}

function buildFirestoreUserPayload(
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
    licenseNumber?: string;
    licenseStatus?: User['licenseStatus'];
    isTradesman?: boolean;
    trade?: string;
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
  },
  options?: {
    omitMedia?: boolean;
  }
) {
  return stripUndefinedFields({
    uid: userId,
    email: data.email,
    name: data.name,
    role: data.role,
    phone: data.phone,
    street: data.street,
    town: data.town,
    zip: data.zip,
    governmentIdImage: options?.omitMedia ? undefined : data.governmentIdImage,
    avatar: options?.omitMedia ? undefined : data.avatar,
    isVerified: data.isVerified ?? false,
    licenseNumber: data.licenseNumber,
    licenseStatus: data.licenseStatus,
    isTradesman: data.isTradesman,
    trade: data.trade,
    subscriptionLevel: data.subscriptionLevel,
    notifyOnNewProjects: data.notifyOnNewProjects,
    notifyOnRoughEstimates: data.notifyOnRoughEstimates,
    notifyOnProductUpdates: data.notifyOnProductUpdates,
    notifyOnSmsLeadAlerts: data.notifyOnSmsLeadAlerts,
    smsConsentAt: data.smsConsentAt,
    accountPlan: data.accountPlan,
    trialStartedAt: data.trialStartedAt,
    trialEndsAt: data.trialEndsAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

async function writeUserDocWithRecovery(
  userId: string,
  data: Parameters<typeof buildFirestoreUserPayload>[1]
) {
  try {
    await setDoc(doc(db, 'users', userId), buildFirestoreUserPayload(userId, data));
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }

    // Retry without large inline media fields so the account can still recover into Settings.
    await setDoc(doc(db, 'users', userId), buildFirestoreUserPayload(userId, data, { omitMedia: true }));
  }
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

      batch.set(doc(db, 'users', nextUser.id), stripUndefinedFields({
        uid: nextUser.id,
        email: nextUser.email,
        name: nextUser.name,
        role: nextUser.role,
        phone: nextUser.phone || submission.phone,
        street: nextUser.street || submission.location.street,
        town: nextUser.town || submission.location.town,
        zip: nextUser.zip || submission.location.zip,
        avatar: nextUser.avatar,
        updatedAt: new Date().toISOString(),
      }), { merge: true });

      await batch.commit();
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
      if (firebaseUser) {
        try {
          const userDoc = await getUserDocWithRetry(firebaseUser.uid);
          if (userDoc) {
            const data = userDoc.data();
            const isAdminEmail = firebaseUser.email?.toLowerCase() === 'blaztprod@gmail.com';
            const role = isAdminEmail ? 'admin' : (data.role as UserRole);

            const userData: User = {
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: role,
              phone: data.phone,
              street: data.street,
              town: data.town,
              zip: data.zip,
              governmentIdImage: data.governmentIdImage,
              avatar: data.avatar || firebaseUser.photoURL || getInitialsAvatar(data.name || firebaseUser.displayName || 'User'),
              rating: role === 'Contractor' ? 4.9 : undefined,
              isVerified: data.isVerified ?? false,
              licenseNumber: data.licenseNumber,
              licenseStatus: data.licenseStatus,
              isTradesman: data.isTradesman,
              trade: data.trade,
              accountPlan: data.accountPlan,
              trialStartedAt: data.trialStartedAt,
              trialEndsAt: data.trialEndsAt,
              subscriptionLevel: data.subscriptionLevel || getDerivedSubscriptionLevel(role, data.createdAt),
              notifyOnNewProjects: data.notifyOnNewProjects ?? (role === 'Contractor'),
              notifyOnRoughEstimates: data.notifyOnRoughEstimates ?? (role === 'Homeowner'),
              notifyOnProductUpdates: data.notifyOnProductUpdates ?? false,
              notifyOnSmsLeadAlerts: data.notifyOnSmsLeadAlerts ?? false,
              smsConsentAt: data.smsConsentAt,
              ...getDerivedTrialFields(role, data.createdAt),
            };
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
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        localStorage.removeItem('blueprint_user');
      }
      setIsLoading(false);
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
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
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
        notifyOnSmsLeadAlerts: false,
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
        notifyOnProductUpdates: false,
        notifyOnSmsLeadAlerts: false,
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
        handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
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
      const updatedUser = { ...user, ...data, ...resolvedMedia };
      const nextSmsOptIn =
        typeof data.notifyOnSmsLeadAlerts === 'boolean'
          ? data.notifyOnSmsLeadAlerts
          : updatedUser.notifyOnSmsLeadAlerts;
      updatedUser.smsConsentAt = nextSmsOptIn
        ? updatedUser.smsConsentAt || new Date().toISOString()
        : undefined;
      const { id: _ignoredId, ...firestoreUserData } = updatedUser;
      
      // If name changed but no avatar provided, update initials avatar if it was using initials
      if (data.name && !data.avatar && user.avatar?.startsWith('data:image/svg+xml')) {
        updatedUser.avatar = getInitialsAvatar(data.name);
        firestoreUserData.avatar = updatedUser.avatar;
      }

      await setDoc(doc(db, 'users', user.id), stripUndefinedFields({
        ...firestoreUserData,
        uid: user.id, // Ensure uid is present
        updatedAt: new Date().toISOString()
      }), { merge: true });

      setUser(updatedUser);
      localStorage.setItem('blueprint_user', JSON.stringify(updatedUser));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
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
