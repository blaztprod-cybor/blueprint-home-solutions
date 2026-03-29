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

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (role?: UserRole) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole, licenseNumber?: string, avatar?: string, isTradesman?: boolean, trade?: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const isAdminEmail = firebaseUser.email?.toLowerCase() === 'blaztprod@gmail.com';
            const role = isAdminEmail ? 'admin' : (data.role as UserRole);

            const userData: User = {
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: role,
              avatar: data.avatar || firebaseUser.photoURL || getInitialsAvatar(data.name || firebaseUser.displayName || 'User'),
              rating: role === 'Contractor' ? 4.9 : undefined,
              isVerified: data.isVerified ?? false
            };
            setUser(userData);
            localStorage.setItem('blueprint_user', JSON.stringify(userData));
          } else {
            // Fallback if doc doesn't exist yet (e.g. during signup process)
            const cachedUser = localStorage.getItem('blueprint_user');
            const role: UserRole = cachedUser ? JSON.parse(cachedUser).role : (firebaseUser.email?.includes('homeowner') ? 'Homeowner' : 'Contractor');
            
            const userData: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: role,
              avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
              rating: role === 'Contractor' ? 4.9 : undefined,
              isVerified: false
            };
            setUser(userData);
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
      await signInWithEmailAndPassword(auth, email, password);
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
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'User',
          role: role,
          avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
          isVerified: false,
          createdAt: new Date().toISOString()
        });
        
        const userData: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          role: role,
          avatar: firebaseUser.photoURL || getInitialsAvatar(firebaseUser.displayName || 'User'),
          isVerified: false
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

  const signup = async (email: string, password: string, name: string, role: UserRole, licenseNumber?: string, avatar?: string, isTradesman?: boolean, trade?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const finalAvatar = avatar || getInitialsAvatar(name);

      const isAdminEmail = email.toLowerCase() === 'blaztprod@gmail.com';
      const finalRole = isAdminEmail ? 'admin' : role;
      
      const userData: User = {
        id: firebaseUser.uid,
        name: name,
        email: email,
        role: finalRole,
        avatar: finalAvatar,
        rating: finalRole === 'Contractor' ? 4.9 : undefined,
        isVerified: false,
        licenseNumber: finalRole === 'Contractor' ? licenseNumber : undefined,
        licenseStatus: finalRole === 'Contractor' ? 'Pending' : undefined,
        isTradesman: finalRole === 'Contractor' ? isTradesman : undefined,
        trade: finalRole === 'Contractor' ? trade : undefined
      };

      // Set user in state first to avoid fallback issues in onAuthStateChanged
      setUser(userData);
      localStorage.setItem('blueprint_user', JSON.stringify(userData));

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: email,
        name: name,
        role: finalRole,
        avatar: finalAvatar,
        isVerified: false,
        licenseNumber: finalRole === 'Contractor' ? licenseNumber : undefined,
        licenseStatus: finalRole === 'Contractor' ? 'Pending' : undefined,
        isTradesman: finalRole === 'Contractor' ? isTradesman : undefined,
        trade: finalRole === 'Contractor' ? trade : undefined,
        createdAt: new Date().toISOString()
      });

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
      
      // If name changed but no avatar provided, update initials avatar if it was using initials
      if (data.name && !data.avatar && user.avatar?.startsWith('data:image/svg+xml')) {
        updatedUser.avatar = getInitialsAvatar(data.name);
      }

      await setDoc(doc(db, 'users', user.id), {
        ...updatedUser,
        uid: user.id, // Ensure uid is present
        updatedAt: new Date().toISOString()
      }, { merge: true });

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
