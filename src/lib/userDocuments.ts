import { User, UserAccount, UserProfile, UserRole } from '../types';

export const USERS_COLLECTION = 'users';
export const USER_PROFILES_COLLECTION = 'user_profiles';

export function stripUndefinedFields<T>(value: T): T {
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

export function getInitialsAvatar(name: string) {
  const names = name.split(' ');
  const initials = names.map((entry) => entry[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#4F46E5', '#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706'];
  const color = colors[Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length];

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${color.replace('#', '%23')}" />
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white">${initials}</text>
  </svg>`;
}

const TRIAL_DURATION_DAYS = 14;

export function getTrialWindow(startIso = new Date().toISOString()) {
  const trialStartedAt = new Date(startIso);
  const trialEndsAt = new Date(trialStartedAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

  return {
    trialStartedAt: trialStartedAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
  };
}

export function getDerivedTrialFields(role: UserRole, createdAt?: string) {
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

export function getDerivedSubscriptionLevel(role: UserRole, createdAt?: string) {
  if (role !== 'Contractor') return 'none' as const;
  if (!createdAt) return 'trial' as const;

  const trialEndsAt = new Date(getTrialWindow(createdAt).trialEndsAt).getTime();
  return trialEndsAt > Date.now() ? ('trial' as const) : ('none' as const);
}

type LegacyUserLike = Partial<User> & {
  uid?: string;
  isDisabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function buildUserAccountPayload(
  userId: string,
  data: {
    email: string;
    role: UserRole;
    isVerified?: boolean;
    isDisabled?: boolean;
    licenseStatus?: User['licenseStatus'];
    subscriptionLevel?: User['subscriptionLevel'];
    accountPlan?: User['accountPlan'];
    trialStartedAt?: string;
    trialEndsAt?: string;
    createdAt?: string;
    updatedAt?: string;
  }
) {
  return stripUndefinedFields({
    uid: userId,
    email: data.email,
    role: data.role,
    isVerified: data.isVerified ?? false,
    isDisabled: data.isDisabled ?? false,
    licenseStatus: data.licenseStatus,
    subscriptionLevel: data.subscriptionLevel,
    accountPlan: data.accountPlan,
    trialStartedAt: data.trialStartedAt,
    trialEndsAt: data.trialEndsAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

export function buildUserProfilePayload(
  userId: string,
  data: {
    name?: string;
    phone?: string;
    street?: string;
    town?: string;
    zip?: string;
    avatar?: string;
    governmentIdImage?: string;
    licenseNumber?: string;
    isTradesman?: boolean;
    trade?: string;
    notifyOnNewProjects?: boolean;
    notifyOnRoughEstimates?: boolean;
    notifyOnProductUpdates?: boolean;
    notifyOnSmsLeadAlerts?: boolean;
    smsConsentAt?: string;
    leadCategories?: string[];
    updatedAt?: string;
  },
  options?: {
    omitMedia?: boolean;
  }
) {
  return stripUndefinedFields({
    uid: userId,
    name: data.name,
    phone: data.phone,
    street: data.street,
    town: data.town,
    zip: data.zip,
    avatar: options?.omitMedia ? undefined : data.avatar,
    governmentIdImage: options?.omitMedia ? undefined : data.governmentIdImage,
    licenseNumber: data.licenseNumber,
    isTradesman: data.isTradesman,
    trade: data.trade,
    notifyOnNewProjects: data.notifyOnNewProjects,
    notifyOnRoughEstimates: data.notifyOnRoughEstimates,
    notifyOnProductUpdates: data.notifyOnProductUpdates,
    notifyOnSmsLeadAlerts: data.notifyOnSmsLeadAlerts,
    smsConsentAt: data.smsConsentAt,
    leadCategories: data.leadCategories,
    updatedAt: data.updatedAt,
  });
}

export function extractLegacyProfilePayload(userId: string, legacy: LegacyUserLike) {
  return buildUserProfilePayload(userId, {
    name: legacy.name,
    phone: legacy.phone,
    street: legacy.street,
    town: legacy.town,
    zip: legacy.zip,
    avatar: legacy.avatar,
    governmentIdImage: legacy.governmentIdImage,
    licenseNumber: legacy.licenseNumber,
    isTradesman: legacy.isTradesman,
    trade: legacy.trade,
    notifyOnNewProjects: legacy.notifyOnNewProjects,
    notifyOnRoughEstimates: legacy.notifyOnRoughEstimates,
    notifyOnProductUpdates: legacy.notifyOnProductUpdates,
    notifyOnSmsLeadAlerts: legacy.notifyOnSmsLeadAlerts,
    smsConsentAt: legacy.smsConsentAt,
    leadCategories: legacy.leadCategories,
    updatedAt: legacy.updatedAt,
  });
}

export function mergeUserDocuments({
  userId,
  email,
  authDisplayName,
  authPhotoURL,
  account,
  profile,
}: {
  userId: string;
  email: string;
  authDisplayName?: string | null;
  authPhotoURL?: string | null;
  account?: Partial<UserAccount> | null;
  profile?: Partial<UserProfile> | null;
}) {
  const role = (account?.role as UserRole | undefined) || 'Homeowner';
  const createdAt = account?.createdAt;
  const name =
    profile?.name ||
    authDisplayName ||
    email.split('@')[0] ||
    'User';

  return {
    id: userId,
    name,
    email,
    role,
    phone: profile?.phone,
    street: profile?.street,
    town: profile?.town,
    zip: profile?.zip,
    avatar: profile?.avatar || authPhotoURL || getInitialsAvatar(name),
    rating: role === 'Contractor' ? 4.9 : undefined,
    isVerified: account?.isVerified ?? false,
    governmentIdImage: profile?.governmentIdImage,
    licenseNumber: profile?.licenseNumber,
    licenseStatus: account?.licenseStatus,
    isTradesman: profile?.isTradesman,
    trade: profile?.trade,
    accountPlan: account?.accountPlan || getDerivedTrialFields(role, createdAt).accountPlan,
    trialStartedAt: account?.trialStartedAt || getDerivedTrialFields(role, createdAt).trialStartedAt,
    trialEndsAt: account?.trialEndsAt || getDerivedTrialFields(role, createdAt).trialEndsAt,
    subscriptionLevel: account?.subscriptionLevel || getDerivedSubscriptionLevel(role, createdAt),
    notifyOnNewProjects: profile?.notifyOnNewProjects ?? (role === 'Contractor'),
    notifyOnRoughEstimates: profile?.notifyOnRoughEstimates ?? (role === 'Homeowner'),
    notifyOnProductUpdates: profile?.notifyOnProductUpdates ?? (role === 'Contractor'),
    notifyOnSmsLeadAlerts: profile?.notifyOnSmsLeadAlerts ?? false,
    smsConsentAt: profile?.smsConsentAt,
    leadCategories: profile?.leadCategories,
  } satisfies User;
}
