import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { auth, db } from './firebase';
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
  getDocFromServer 
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
              subscriptionLevel: data.subscriptionLevel || getDerivedSubscriptionLevel(role, data.createdAt),
              ...getDerivedTrialFields(role, data.createdAt),
            };
            setUser(userData);
            localStorage.setItem('blueprint_user', JSON.stringify(userData));
          } else {
            sessionStorage.setItem('blueprint_auth_notice', MISSING_ACCOUNT_NOTICE);
            localStorage.removeItem('blueprint_user');
            setUser(null);
            await signOut(auth);
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
        sessionStorage.setItem('blueprint_auth_notice', MISSING_ACCOUNT_NOTICE);
        await signOut(auth);
        const error = new Error(MISSING_ACCOUNT_NOTICE) as Error & { code?: string };
        error.code = 'auth/account-record-not-found';
        throw error;
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
        await setDoc(doc(db, 'users', firebaseUser.uid), stripUndefinedFields({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'User',
          role: role,
          avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
          isVerified: false,
          subscriptionLevel: getDerivedSubscriptionLevel(role),
          createdAt: new Date().toISOString(),
        }));
        
        const userData: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          role: role,
          avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
          isVerified: false,
          subscriptionLevel: getDerivedSubscriptionLevel(role),
          ...getDerivedTrialFields(role),
        };
        setUser(userData);

        // Send welcome email
        try {
          console.log(`[AuthContext] Attempting to send welcome email to ${firebaseUser.email}...`);
          const welcomeResponse = await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: firebaseUser.email,
              name: firebaseUser.displayName || 'User',
              role: role
            })
          });
          const welcomeResult = await welcomeResponse.json();
          console.log("[AuthContext] Welcome email API response:", welcomeResult);
        } catch (emailError) {
          console.error("[AuthContext] Failed to send welcome email:", emailError);
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
    }
  ) => {
    const nextProfile = profile || {};
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const finalAvatar = nextProfile.avatar || getInitialsAvatar(name);

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
        governmentIdImage: finalRole === 'Contractor' ? nextProfile.governmentIdImage : undefined,
        licenseNumber: finalRole === 'Contractor' ? nextProfile.licenseNumber : undefined,
        licenseStatus: finalRole === 'Contractor' ? 'Pending' : undefined,
        isTradesman: finalRole === 'Contractor' ? nextProfile.isTradesman : undefined,
        trade: finalRole === 'Contractor' ? nextProfile.trade : undefined,
        subscriptionLevel: getDerivedSubscriptionLevel(finalRole),
        ...getDerivedTrialFields(finalRole),
      };

      // Set user in state first to avoid fallback issues in onAuthStateChanged
      setUser(userData);
      localStorage.setItem('blueprint_user', JSON.stringify(userData));

      await setDoc(doc(db, 'users', firebaseUser.uid), stripUndefinedFields({
        uid: firebaseUser.uid,
        email: email,
        name: name,
        role: finalRole,
        phone: nextProfile.phone,
        street: nextProfile.street,
        town: nextProfile.town,
        zip: nextProfile.zip,
        avatar: finalAvatar,
        isVerified: false,
        governmentIdImage: finalRole === 'Contractor' ? nextProfile.governmentIdImage : undefined,
        licenseNumber: finalRole === 'Contractor' ? nextProfile.licenseNumber : undefined,
        licenseStatus: finalRole === 'Contractor' ? 'Pending' : undefined,
        isTradesman: finalRole === 'Contractor' ? nextProfile.isTradesman : undefined,
        trade: finalRole === 'Contractor' ? nextProfile.trade : undefined,
        subscriptionLevel: getDerivedSubscriptionLevel(finalRole),
        createdAt: new Date().toISOString(),
      }));

      // Send welcome email
      try {
        console.log(`[AuthContext] Attempting to send welcome email to ${email}...`);
        const welcomeResponse = await fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            name: name,
            role: finalRole
          })
        });
        const welcomeResult = await welcomeResponse.json();
        console.log("[AuthContext] Welcome email API response:", welcomeResult);
      } catch (emailError) {
        console.error("[AuthContext] Failed to send welcome email:", emailError);
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
      const updatedUser = { ...user, ...data };
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
