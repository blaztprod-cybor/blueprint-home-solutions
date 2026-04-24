import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { authorizedApiFetch } from '../lib/authorizedApi';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Project, User } from '../types';
import { cn } from '../lib/utils';
import {
  mergeUserDocuments,
  USER_PROFILES_COLLECTION,
  USERS_COLLECTION,
} from '../lib/userDocuments';

type Review = {
  id: string;
  authorId: string;
  targetId: string;
  projectId: string;
  rating: number;
  content: string;
  authorName: string;
  authorRole: string;
  projectName: string;
  createdAt: string;
};

type AdminUser = User & {
  createdAt?: string;
  isDisabled?: boolean;
};

type AdminProject = Project & {
  contactSanitized?: boolean;
};

type ContactComposerState = {
  mode: 'email' | 'sms';
  user: AdminUser;
  subject: string;
  message: string;
} | null;

type VerificationViewerState = {
  name: string;
  avatar?: string;
  governmentIdImage?: string;
} | null;

type AdminTab = 'users' | 'projects' | 'reviews';
type AdminFilter =
  | 'all'
  | 'verified'
  | 'unverified'
  | 'licensed'
  | 'unlicensed'
  | 'homeowner'
  | 'active'
  | 'completed'
  | 'flagged';
type SubscriptionLevel = 'none' | 'trial' | 'beginner' | 'junior' | 'pro';
type UserSort = 'name' | 'newest' | 'oldest';
type BroadcastSegment = 'all' | 'homeowners' | 'contractors' | 'verified' | 'unverified' | 'licensed' | 'unlicensed';

const SUBSCRIPTION_OPTIONS: SubscriptionLevel[] = ['none', 'trial', 'beginner', 'junior', 'pro'];
const API_ENABLED_SUBSCRIPTION_LEVELS = new Set<SubscriptionLevel>(['trial', 'beginner', 'junior', 'pro']);
const BROADCAST_SEGMENTS: BroadcastSegment[] = ['all', 'homeowners', 'contractors', 'verified', 'unverified', 'licensed', 'unlicensed'];
const BROADCAST_SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  all: 'All',
  homeowners: 'Homeowners',
  contractors: 'Contractors',
  verified: 'Verified',
  unverified: 'Unverified',
  licensed: 'Licensed',
  unlicensed: 'Unlicensed',
};

const ADMIN_TOOL_LINKS = [
  {
    href: '/permit-feed',
    label: 'Filing Leads',
    description: 'DOB filing lead board',
    icon: Building2,
  },
  {
    href: '/api-intelligence',
    label: 'API Intelligence',
    description: 'Protected DOB intelligence feed',
    icon: ChevronRight,
  },
  {
    href: '/elevator-intelligence',
    label: 'Pre-Filing Elevator',
    description: 'Opportunity scan before filing',
    icon: Building2,
  },
  {
    href: '/elevator-filings',
    label: 'Elevator Filings',
    description: 'Live elevator modernization feed',
    icon: Building2,
  },
];

function toIsoDateString(value: unknown) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return ((value as { toDate: () => Date }).toDate()).toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const PHONE_PATTERN = /(?:\+?1[\s.-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s./-]*\d{3}[\s./-]*\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_DETECT_PATTERN = /(?:\+?1[\s.-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s./-]*\d{3}[\s./-]*\d{4}\b/;
const EMAIL_DETECT_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function stripSensitiveText(value: string | undefined) {
  return (value || '').replace(PHONE_PATTERN, '[removed]').replace(EMAIL_PATTERN, '[removed]').trim();
}

function hasSensitiveText(value: string | undefined) {
  if (!value) return false;
  return PHONE_DETECT_PATTERN.test(value) || EMAIL_DETECT_PATTERN.test(value);
}

function buildSmsHref(phone: string, body: string) {
  const trimmedPhone = String(phone || '').trim();
  const trimmedBody = String(body || '').trim();
  if (!trimmedPhone) return '';

  if (!trimmedBody) {
    return `sms:${trimmedPhone}`;
  }

  const isAppleDevice =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const separator = isAppleDevice ? '&' : '?';

  return `sms:${trimmedPhone}${separator}body=${encodeURIComponent(trimmedBody)}`;
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [filter, setFilter] = useState<AdminFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [userSort, setUserSort] = useState<UserSort>('name');
  const [broadcastSegments, setBroadcastSegments] = useState<BroadcastSegment[]>(['all']);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState('');
  const [broadcastError, setBroadcastError] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [isSendingSmsBroadcast, setIsSendingSmsBroadcast] = useState(false);
  const [smsBroadcastResult, setSmsBroadcastResult] = useState('');
  const [smsBroadcastError, setSmsBroadcastError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [contactComposer, setContactComposer] = useState<ContactComposerState>(null);
  const [contactComposerError, setContactComposerError] = useState('');
  const [verificationViewer, setVerificationViewer] = useState<VerificationViewerState>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const [usersSnapshot, userProfilesSnapshot, projectsSnapshot, reviewsSnapshot] = await Promise.all([
        getDocs(query(collection(db, USERS_COLLECTION))),
        getDocs(query(collection(db, USER_PROFILES_COLLECTION))),
        getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))),
      ]);

      const profileMap = new Map(
        userProfilesSnapshot.docs.map((entry) => [entry.id, entry.data()])
      );

      const userDocs = usersSnapshot.docs.map((entry) => {
        const data = entry.data();
        const profile = profileMap.get(entry.id);
        const mergedUser = mergeUserDocuments({
          userId: entry.id,
          email: String(data.email || ''),
          account: {
            id: entry.id,
            uid: entry.id,
            ...data,
            createdAt: toIsoDateString((data as { createdAt?: unknown }).createdAt),
            updatedAt: toIsoDateString((data as { updatedAt?: unknown }).updatedAt),
          },
          profile: profile
            ? {
                id: entry.id,
                uid: entry.id,
                ...profile,
              }
            : {
                id: entry.id,
                uid: entry.id,
                ...data,
              },
        });

        return {
          id: entry.id,
          ...mergedUser,
          isDisabled: !!data.isDisabled,
          createdAt: toIsoDateString((data as { createdAt?: unknown }).createdAt),
        };
      }) as AdminUser[];

      const projectDocs = projectsSnapshot.docs.map((entry) => {
        const data = entry.data() as AdminProject;
        return {
          id: entry.id,
          ...data,
          contactSanitized: !hasSensitiveText(data.description) && !hasSensitiveText(data.phone),
        };
      }) as AdminProject[];

      const hydratedProjectDocs = await Promise.all(
        projectDocs.map(async (project) => {
          if ((project.photos?.length || 0) > 0 || (project.photoCount || 0) === 0) {
            return project;
          }

          try {
            const photosSnapshot = await getDocs(
              query(collection(db, 'projects', project.id, 'photos'), orderBy('createdAt', 'asc'), limit(3))
            );
            const fallbackPhotos = photosSnapshot.docs.map((entry) => entry.data().url).filter(Boolean);
            if (fallbackPhotos.length === 0) {
              return project;
            }

            await updateDoc(doc(db, 'projects', project.id), {
              photos: fallbackPhotos,
              updatedAt: new Date().toISOString(),
            });

            return { ...project, photos: fallbackPhotos };
          } catch (syncError) {
            console.error('Error hydrating admin project photos:', syncError);
            return project;
          }
        })
      );

      const reviewDocs = reviewsSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })) as Review[];

      setUsers(userDocs);
      setProjects(hydratedProjectDocs);
      setReviews(reviewDocs);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to load admin data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilter('all');
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      setUserSort('name');
    }
  }, [activeTab]);

  const filteredUsers = useMemo(() => {
    const nextUsers = users.filter((user) => {
      const matchesSearch = [user.name, user.email, user.licenseNumber, user.role]
        .some((value) => String(value || '').toLowerCase().includes(searchQuery.toLowerCase()));
      const hasLicense = !!user.licenseNumber?.trim();
      const matchesFilter =
        filter === 'all' ||
        (filter === 'verified' && !!user.isVerified) ||
        (filter === 'unverified' && !user.isVerified) ||
        (filter === 'licensed' && user.role === 'Contractor' && hasLicense) ||
        (filter === 'unlicensed' && user.role === 'Contractor' && !hasLicense) ||
        (filter === 'homeowner' && user.role === 'Homeowner');
      return matchesSearch && matchesFilter;
    });

    nextUsers.sort((left, right) => {
      if (userSort === 'newest') {
        return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
      }
      if (userSort === 'oldest') {
        return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
      }
      return (left.name || '').localeCompare(right.name || '');
    });

    return nextUsers;
  }, [users, searchQuery, filter, userSort]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = [project.title, project.category, project.description, project.phone]
        .some((value) => String(value || '').toLowerCase().includes(searchQuery.toLowerCase()));
      const isFlagged = hasSensitiveText(project.description) || hasSensitiveText(project.phone);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && project.status !== 'Completed') ||
        (filter === 'completed' && project.status === 'Completed') ||
        (filter === 'flagged' && isFlagged);
      return matchesSearch && matchesFilter;
    });
  }, [projects, searchQuery, filter]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesSearch = [review.authorName, review.projectName, review.content]
        .some((value) => String(value || '').toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = filter === 'all' || (filter === 'flagged' && hasSensitiveText(review.content));
      return matchesSearch && matchesFilter;
    });
  }, [reviews, searchQuery, filter]);

  const optedInUsers = useMemo(
    () =>
      users.filter((entry) => entry.notifyOnProductUpdates === true && !!entry.email && !entry.isDisabled),
    [users]
  );

  const broadcastSegmentCounts = useMemo(
    () => ({
      all: optedInUsers.filter((entry) => entry.role === 'Contractor' || entry.role === 'Homeowner').length,
      homeowners: optedInUsers.filter((entry) => entry.role === 'Homeowner').length,
      contractors: optedInUsers.filter((entry) => entry.role === 'Contractor').length,
      verified: optedInUsers.filter((entry) => !!entry.isVerified).length,
      unverified: optedInUsers.filter((entry) => !entry.isVerified).length,
      licensed: optedInUsers.filter((entry) => entry.role === 'Contractor' && !!entry.licenseNumber?.trim()).length,
      unlicensed: optedInUsers.filter((entry) => entry.role === 'Contractor' && !entry.licenseNumber?.trim()).length,
    }),
    [optedInUsers]
  );

  const selectedBroadcastRecipients = useMemo(() => {
    const segments = broadcastSegments.includes('all') ? ['all'] : broadcastSegments;
    return optedInUsers.filter((entry) => {
      if (segments.includes('all')) {
        return entry.role === 'Contractor' || entry.role === 'Homeowner';
      }

      return segments.some((segment) => {
        switch (segment) {
          case 'homeowners':
            return entry.role === 'Homeowner';
          case 'contractors':
            return entry.role === 'Contractor';
          case 'verified':
            return !!entry.isVerified;
          case 'unverified':
            return !entry.isVerified;
          case 'licensed':
            return entry.role === 'Contractor' && !!entry.licenseNumber?.trim();
          case 'unlicensed':
            return entry.role === 'Contractor' && !entry.licenseNumber?.trim();
          default:
            return false;
        }
      });
    });
  }, [broadcastSegments, optedInUsers]);

  const smsReadyContractors = useMemo(
    () =>
      users.filter(
        (entry) =>
          entry.role === 'Contractor' &&
          !entry.isDisabled &&
          entry.notifyOnSmsLeadAlerts === true &&
          !!entry.smsConsentAt &&
          !!entry.phone?.trim()
      ),
    [users]
  );

  const toggleBroadcastSegment = (segment: BroadcastSegment) => {
    setBroadcastSegments((current) => {
      if (segment === 'all') {
        return current.includes('all') ? [] : ['all'];
      }

      const withoutAll = current.filter((entry) => entry !== 'all');
      return withoutAll.includes(segment)
        ? withoutAll.filter((entry) => entry !== segment)
        : [...withoutAll, segment];
    });
  };

  const sendBroadcastUpdate = async () => {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
      setBroadcastError('Subject and message are required.');
      return;
    }

    if (broadcastSegments.length === 0) {
      setBroadcastError('Select at least one audience segment.');
      return;
    }

    setIsSendingBroadcast(true);
    setBroadcastError('');
    setBroadcastResult('');

    try {
      const response = await fetch('/api/send-broadcast-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceSegments: broadcastSegments,
          recipients: selectedBroadcastRecipients.map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            isVerified: !!recipient.isVerified,
            licenseNumber: recipient.licenseNumber || '',
          })),
          subject: broadcastSubject.trim(),
          message: broadcastMessage.trim(),
          sentBy: 'Blueprint Admin',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to send broadcast update');
      }

      setBroadcastResult(
        `Sent ${payload?.sent ?? 0} emails to ${payload?.recipients ?? selectedBroadcastRecipients.length} selected opted-in recipients.`
      );
      setBroadcastMessage('');
    } catch (error) {
      setBroadcastError(error instanceof Error ? error.message : 'Failed to send broadcast update');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const sendSmsBroadcast = async () => {
    if (!smsMessage.trim()) {
      setSmsBroadcastError('SMS message is required.');
      return;
    }

    if (smsReadyContractors.length === 0) {
      setSmsBroadcastError('No SMS-ready contractors are available.');
      return;
    }

    setIsSendingSmsBroadcast(true);
    setSmsBroadcastError('');
    setSmsBroadcastResult('');

    try {
      const response = await authorizedApiFetch('/api/send-broadcast-sms', {
        method: 'POST',
        body: JSON.stringify({
          recipients: smsReadyContractors.map((recipient) => ({
            phone: recipient.phone,
            role: recipient.role,
            name: recipient.name,
          })),
          message: smsMessage.trim(),
          sentBy: 'Blueprint Admin',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to send broadcast SMS');
      }

      setSmsBroadcastResult(
        `Sent ${payload?.sent ?? 0} texts to ${payload?.recipients ?? smsReadyContractors.length} SMS-ready contractors.`
      );
      setSmsMessage('');
    } catch (error) {
      setSmsBroadcastError(error instanceof Error ? error.message : 'Failed to send broadcast SMS');
    } finally {
      setIsSendingSmsBroadcast(false);
    }
  };

  const openUserSmsComposer = (user: AdminUser) => {
    if (!user.phone?.trim()) {
      window.alert('This user does not have a saved phone number.');
      return;
    }

    setContactComposerError('');
    setContactComposer({
      mode: 'sms',
      user,
      subject: '',
      message: '',
    });
  };

  const openUserEmailComposer = (user: AdminUser) => {
    if (!user.email?.trim()) {
      window.alert('This user does not have a saved email address.');
      return;
    }

    setContactComposerError('');
    setContactComposer({
      mode: 'email',
      user,
      subject: 'Blueprint Home Solutions update',
      message: '',
    });
  };

  const sendComposedMessage = async () => {
    if (!contactComposer) return;

    const { user, mode, subject, message } = contactComposer;
    if (mode === 'email' && !subject.trim()) {
      setContactComposerError('Email subject is required.');
      return;
    }
    if (!message.trim()) {
      setContactComposerError(mode === 'email' ? 'Email message is required.' : 'Text message is required.');
      return;
    }

    setUpdatingId(user.id);
    setContactComposerError('');
    try {
      if (mode === 'email') {
        const response = await authorizedApiFetch('/api/send-admin-message', {
          method: 'POST',
          body: JSON.stringify({
            email: user.email?.trim(),
            name: user.name,
            subject: subject.trim(),
            message: message.trim(),
            recipientType: user.role === 'Contractor' ? 'home-pro' : 'homeowner',
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || response.statusText || `Failed to send email (${response.status})`);
        }
        window.alert(`Email sent to ${user.name || user.email}.`);
      } else {
        const response = await authorizedApiFetch('/api/send-admin-sms', {
          method: 'POST',
          body: JSON.stringify({
            phone: user.phone?.trim(),
            message: message.trim(),
            recipientType: user.role === 'Contractor' ? 'home-pro' : 'homeowner',
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload?.error ||
            payload?.message ||
            response.statusText ||
            `Failed to send text (${response.status})`
          );
        }
        window.alert(`Text sent to ${user.name || user.email || user.phone}.`);
      }
      setContactComposer(null);
    } catch (error) {
      setContactComposerError(error instanceof Error ? error.message : `Failed to send ${mode === 'email' ? 'email' : 'text'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const openMessagingApp = () => {
    if (!contactComposer || contactComposer.mode !== 'sms') return;
    const smsHref = buildSmsHref(contactComposer.user.phone || '', contactComposer.message);
    if (!smsHref) {
      setContactComposerError('This user does not have a saved phone number.');
      return;
    }

    window.location.href = smsHref;
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    setUpdatingId(userId);
    try {
      const targetUser = users.find((entry) => entry.id === userId);
      if (!targetUser) return;

      const nextStatus = !currentStatus;
      const response = await authorizedApiFetch('/api/admin-update-user', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          email: targetUser.email,
          role: targetUser.role,
          createdAt: targetUser.createdAt,
          isVerified: nextStatus,
          isDisabled: !!targetUser.isDisabled,
          licenseStatus: nextStatus ? 'Active' : 'Pending',
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update user');
      }
      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? { ...user, isVerified: nextStatus, licenseStatus: nextStatus ? 'Active' : 'Pending' }
            : user
        )
      );
    } catch (error) {
      console.error('Error toggling verification:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleUserDisabled = async (user: AdminUser) => {
    const nextValue = !user.isDisabled;
    const confirmed = window.confirm(
      `${nextValue ? 'Disable' : 'Re-enable'} ${user.name || user.email || 'this account'}?`
    );
    if (!confirmed) return;

    setUpdatingId(user.id);
    try {
      const response = await authorizedApiFetch('/api/admin-update-user', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          isVerified: !!user.isVerified,
          isDisabled: nextValue,
          licenseStatus: user.licenseStatus,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update user');
      }
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, isDisabled: nextValue } : entry))
      );
    } catch (error) {
      console.error('Error toggling user disabled state:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateSubscriptionLevel = async (user: AdminUser, subscriptionLevel: SubscriptionLevel) => {
    setUpdatingId(user.id);
    try {
      const response = await authorizedApiFetch('/api/admin-update-user', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          isVerified: !!user.isVerified,
          isDisabled: !!user.isDisabled,
          licenseStatus: user.licenseStatus,
          subscriptionLevel,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update user');
      }
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, subscriptionLevel } : entry))
      );
    } catch (error) {
      console.error('Error updating subscription level:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleApiAccess = async (user: AdminUser) => {
    const hasApiAccess = API_ENABLED_SUBSCRIPTION_LEVELS.has((user.subscriptionLevel || 'none') as SubscriptionLevel);
    const nextSubscriptionLevel: SubscriptionLevel = hasApiAccess ? 'none' : ((user.subscriptionLevel || 'trial') === 'none' ? 'trial' : (user.subscriptionLevel as SubscriptionLevel));
    const confirmed = window.confirm(
      `${hasApiAccess ? 'Disable' : 'Enable'} API access for ${user.name || user.email || 'this user'}?`
    );
    if (!confirmed) return;

    await updateSubscriptionLevel(user, nextSubscriptionLevel);
  };

  const deleteUserDocument = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Delete the Firestore account record for ${user.name || user.email || user.id}? This does not remove Firebase Auth credentials.`
    );
    if (!confirmed) return;

    setUpdatingId(user.id);
    try {
      const response = await authorizedApiFetch('/api/admin-delete-user-docs', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete user docs');
      }
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
    } catch (error) {
      console.error('Error deleting user document:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const scrubProjectContact = async (project: AdminProject) => {
    const confirmed = window.confirm(`Remove phone numbers and emails from project "${project.title}"?`);
    if (!confirmed) return;

    setUpdatingId(project.id);
    try {
      const nextDescription = stripSensitiveText(project.description);
      const nextPhone = stripSensitiveText(project.phone);
      await updateDoc(doc(db, 'projects', project.id), {
        description: nextDescription,
        phone: nextPhone,
        contactSanitized: true,
        updatedAt: new Date().toISOString(),
      });
      setProjects((current) =>
        current.map((entry) =>
          entry.id === project.id
            ? { ...entry, description: nextDescription, phone: nextPhone, contactSanitized: true }
            : entry
        )
      );
    } catch (error) {
      console.error('Error scrubbing project contact info:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteProject = async (project: AdminProject) => {
    const confirmed = window.confirm(`Delete project "${project.title}"? This removes the project document.`);
    if (!confirmed) return;

    setUpdatingId(project.id);
    try {
      await deleteDoc(doc(db, 'projects', project.id));
      setProjects((current) => current.filter((entry) => entry.id !== project.id));
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const scrubReviewContent = async (review: Review) => {
    const confirmed = window.confirm(`Remove phone numbers and emails from review by ${review.authorName}?`);
    if (!confirmed) return;

    setUpdatingId(review.id);
    try {
      const nextContent = stripSensitiveText(review.content);
      await updateDoc(doc(db, 'reviews', review.id), {
        content: nextContent,
        updatedAt: new Date().toISOString(),
      });
      setReviews((current) =>
        current.map((entry) => (entry.id === review.id ? { ...entry, content: nextContent } : entry))
      );
    } catch (error) {
      console.error('Error scrubbing review content:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteReview = async (review: Review) => {
    const confirmed = window.confirm(`Delete review for "${review.projectName}" by ${review.authorName}?`);
    if (!confirmed) return;

    setUpdatingId(review.id);
    try {
      await deleteDoc(doc(db, 'reviews', review.id));
      setReviews((current) => current.filter((entry) => entry.id !== review.id));
    } catch (error) {
      console.error('Error deleting review:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const tabButton = (tab: AdminTab, label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={cn(
        'px-6 py-2.5 rounded-2xl text-sm font-bold transition-all',
        activeTab === tab
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      )}
    >
      {label}
    </button>
  );

  const filterOptions: AdminFilter[] =
    activeTab === 'users'
      ? ['all', 'homeowner', 'verified', 'unverified', 'licensed', 'unlicensed']
      : activeTab === 'projects'
        ? ['all', 'active', 'completed', 'flagged']
        : ['all', 'flagged'];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {verificationViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="w-full max-w-4xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Identity Review</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{verificationViewer.name}</h2>
              </div>
              <button
                onClick={() => setVerificationViewer(null)}
                className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close verification viewer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Verified Selfie</p>
                {verificationViewer.avatar ? (
                  <img
                    src={verificationViewer.avatar}
                    alt={`${verificationViewer.name} selfie`}
                    className="h-[360px] w-full rounded-3xl border border-slate-200 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                    No selfie uploaded
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Government ID / Driver&apos;s License</p>
                {verificationViewer.governmentIdImage ? (
                  <img
                    src={verificationViewer.governmentIdImage}
                    alt={`${verificationViewer.name} government ID`}
                    className="h-[360px] w-full rounded-3xl border border-slate-200 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                    No ID uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {contactComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {contactComposer.mode === 'email' ? 'Direct Email' : 'Direct Text'}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {contactComposer.mode === 'email' ? 'Compose Email' : 'Compose Text'}
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Review the recipient details before sending.
                </p>
              </div>
              <button
                onClick={() => {
                  setContactComposer(null);
                  setContactComposerError('');
                }}
                className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close contact composer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recipient</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{contactComposer.user.name || 'Unnamed User'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Email</p>
                <p className="mt-2 break-all text-sm font-medium text-slate-700">{contactComposer.user.email || 'No email saved'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Phone</p>
                <p className="mt-2 text-sm font-medium text-slate-700">{contactComposer.user.phone || 'No phone saved'}</p>
              </div>
            </div>

            {contactComposer.mode === 'email' && (
              <label className="mt-5 block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Subject</span>
                <input
                  value={contactComposer.subject}
                  onChange={(event) =>
                    setContactComposer((current) => (current ? { ...current, subject: event.target.value } : current))
                  }
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                  placeholder="Blueprint Home Solutions update"
                />
              </label>
            )}

            <label className="mt-5 block space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {contactComposer.mode === 'email' ? 'Message' : 'Text Message'}
              </span>
              <textarea
                value={contactComposer.message}
                onChange={(event) =>
                  setContactComposer((current) => (current ? { ...current, message: event.target.value } : current))
                }
                rows={6}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                placeholder={
                  contactComposer.mode === 'email'
                    ? 'Write the email you want to send.'
                    : 'Write the text message you want to send.'
                }
              />
            </label>

            {contactComposerError && (
              <p className="mt-4 text-sm font-semibold text-rose-600">{contactComposerError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              {contactComposer.mode === 'sms' && (
                <button
                  onClick={openMessagingApp}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Open Messaging App
                </button>
              )}
              <button
                onClick={() => {
                  setContactComposer(null);
                  setContactComposerError('');
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={sendComposedMessage}
                disabled={updatingId === contactComposer.user.id}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingId === contactComposer.user.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : contactComposer.mode === 'email' ? (
                  <Mail size={16} />
                ) : (
                  <MessageSquare size={16} />
                )}
                Send {contactComposer.mode === 'email' ? 'Email' : 'Text'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Moderate users, projects, and reviews from one place.
          </p>
          {fetchError && (
            <div className="mt-4 space-y-2">
              {fetchError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {fetchError}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {tabButton('users', 'Users')}
          {tabButton('projects', 'Projects')}
          {tabButton('reviews', 'Reviews')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Users</p>
            <p className="text-2xl font-black text-slate-900">{users.length}</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <UserIcon size={20} />
          </div>
        </div>
        <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flagged Projects</p>
            <p className="text-2xl font-black text-slate-900">
              {projects.filter((project) => hasSensitiveText(project.description) || hasSensitiveText(project.phone)).length}
            </p>
          </div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flagged Reviews</p>
            <p className="text-2xl font-black text-slate-900">
              {reviews.filter((review) => hasSensitiveText(review.content)).length}
            </p>
          </div>
          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900">Admin Tools</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Open the live filing and elevator intelligence surfaces directly from the dashboard.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_TOOL_LINKS.map(({ href, label, description, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-200/60"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Icon size={20} />
              </div>
              <div className="mt-4">
                <p className="text-base font-black tracking-tight text-slate-900">{label}</p>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p>
              </div>
              <div className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition-colors group-hover:text-slate-700">
                Open
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", activeTab === 'users' ? 'md:grid-cols-[minmax(0,340px)_1fr]' : 'md:grid-cols-3')}>
        <div className={cn("relative", activeTab !== 'users' && 'md:col-span-2')}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            placeholder={
              activeTab === 'users'
                ? 'Search by name, email, role, or license...'
                : activeTab === 'projects'
                  ? 'Search by project title, category, description, or phone...'
                  : 'Search by author, project name, or review content...'
            }
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
          />
        </div>
        <div className="flex gap-2 flex-wrap justify-start">
          {filterOptions.map((entry) => (
            <button
              key={entry}
              onClick={() => setFilter(entry)}
              className={cn(
                'px-4 py-3 rounded-2xl text-sm font-bold capitalize transition-all whitespace-nowrap',
                filter === entry
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)_auto] md:items-start">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Mail size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">Broadcast Updates</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Send one email to selected homeowners and contractors using checkbox filters.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Audience</span>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {BROADCAST_SEGMENTS.map((segment) => (
                      <label key={segment} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                        <input
                          type="checkbox"
                          checked={broadcastSegments.includes(segment)}
                          onChange={() => toggleBroadcastSegment(segment)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                        />
                        <span>
                          {BROADCAST_SEGMENT_LABELS[segment]} ({broadcastSegmentCounts[segment]})
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {selectedBroadcastRecipients.length} opted-in recipient{selectedBroadcastRecipients.length === 1 ? '' : 's'} currently selected.
                  </p>
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Subject</span>
                <input
                  value={broadcastSubject}
                  onChange={(event) => setBroadcastSubject(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                  placeholder="Blueprint platform update"
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Message</span>
              <textarea
                value={broadcastMessage}
                onChange={(event) => setBroadcastMessage(event.target.value)}
                rows={6}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                placeholder="Write the update you want to send to the selected audience."
              />
            </label>

            {broadcastError && (
              <p className="mt-3 text-sm font-semibold text-rose-600">{broadcastError}</p>
            )}
            {broadcastResult && (
              <p className="mt-3 text-sm font-semibold text-emerald-600">{broadcastResult}</p>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={sendBroadcastUpdate}
                disabled={isSendingBroadcast}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingBroadcast ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Send Broadcast
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">Contractor SMS</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Send a blanket text to contractors who have a saved phone, SMS opt-in, and consent timestamp.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">SMS-Ready Contractors</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{smsReadyContractors.length}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Only contractors with `phone`, `notifyOnSmsLeadAlerts`, and `smsConsentAt` are included.
              </p>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Text Message</span>
              <textarea
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                rows={6}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                placeholder="Write the text message for opted-in contractors."
              />
            </label>

            {smsBroadcastError && (
              <p className="mt-3 text-sm font-semibold text-rose-600">{smsBroadcastError}</p>
            )}
            {smsBroadcastResult && (
              <p className="mt-3 text-sm font-semibold text-emerald-600">{smsBroadcastResult}</p>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={sendSmsBroadcast}
                disabled={isSendingSmsBroadcast}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingSmsBroadcast ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                Send Text Blast
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <label className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Sort Users</span>
              <select
                value={userSort}
                onChange={(event) => setUserSort(event.target.value as UserSort)}
                className="h-11 min-w-[160px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-primary"
              >
                <option value="name">Name</option>
                <option value="newest">Newest Joined</option>
                <option value="oldest">Oldest Joined</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fetching Data...</p>
          </div>
        ) : fetchError ? (
          <div className="p-10">
            <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
              <p className="font-bold uppercase tracking-widest text-red-500 text-[10px]">Admin Load Error</p>
              <p className="mt-2 font-medium">{fetchError}</p>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">User</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Joined</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role / License</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">UID</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verification</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Subscription</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">API Access</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon size={20} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{user.name || 'Unnamed User'}</p>
                            <p className="text-xs text-muted-foreground font-medium">{user.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">
                            {user.createdAt ? new Date(user.createdAt).toLocaleTimeString() : 'No timestamp'}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-bold text-slate-700">{user.role}</p>
                        <p className="text-xs text-slate-500 font-medium">{user.licenseNumber || 'No License Number'}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="max-w-[220px] truncate font-mono text-xs font-bold text-slate-700" title={user.id}>
                          {user.id}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-2">
                          <div className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                            user.isVerified ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                          )}>
                            {user.isVerified ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                            {user.isVerified ? 'Verified' : 'Unverified'}
                          </div>
                          {user.isDisabled && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-rose-50 text-rose-600 border-rose-100">
                              <Ban size={14} />
                              Disabled
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Level</p>
                          <select
                            value={user.subscriptionLevel || 'none'}
                            onChange={(event) => updateSubscriptionLevel(user, event.target.value as SubscriptionLevel)}
                            disabled={updatingId === user.id}
                            className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary disabled:opacity-50"
                          >
                            {SUBSCRIPTION_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-2">
                          <div
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold',
                              API_ENABLED_SUBSCRIPTION_LEVELS.has((user.subscriptionLevel || 'none') as SubscriptionLevel)
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                            )}
                          >
                            {API_ENABLED_SUBSCRIPTION_LEVELS.has((user.subscriptionLevel || 'none') as SubscriptionLevel) ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                            {API_ENABLED_SUBSCRIPTION_LEVELS.has((user.subscriptionLevel || 'none') as SubscriptionLevel) ? 'Enabled' : 'Disabled'}
                          </div>
                          <button
                            onClick={() => void toggleApiAccess(user)}
                            disabled={updatingId === user.id}
                            className={cn(
                              'px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50',
                              API_ENABLED_SUBSCRIPTION_LEVELS.has((user.subscriptionLevel || 'none') as SubscriptionLevel)
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            )}
                          >
                            {API_ENABLED_SUBSCRIPTION_LEVELS.has((user.subscriptionLevel || 'none') as SubscriptionLevel) ? 'Disable API' : 'Enable API'}
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleVerification(user.id, !!user.isVerified)}
                            disabled={updatingId === user.id}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-slate-900 text-white"
                          >
                            {updatingId === user.id ? <Loader2 size={14} className="animate-spin" /> : user.isVerified ? 'Revoke' : 'Verify'}
                          </button>
                          <button
                            onClick={() => toggleUserDisabled(user)}
                            disabled={updatingId === user.id}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-amber-50 text-amber-700 border border-amber-100"
                          >
                            {user.isDisabled ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            onClick={() =>
                              setVerificationViewer({
                                name: user.name || user.email || 'User',
                                avatar: user.avatar,
                                governmentIdImage: user.governmentIdImage,
                              })
                            }
                            disabled={updatingId === user.id || (!user.avatar && !user.governmentIdImage)}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-violet-50 text-violet-700 border border-violet-100"
                          >
                            Review ID
                          </button>
                          <button
                            onClick={() => openUserEmailComposer(user)}
                            disabled={updatingId === user.id || !user.email?.trim()}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-sky-50 text-sky-700 border border-sky-100"
                          >
                            {updatingId === user.id ? <Loader2 size={14} className="animate-spin" /> : 'Email'}
                          </button>
                          <button
                            onClick={() => openUserSmsComposer(user)}
                            disabled={updatingId === user.id || !user.phone?.trim()}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-emerald-50 text-emerald-700 border border-emerald-100"
                          >
                            {updatingId === user.id ? <Loader2 size={14} className="animate-spin" /> : 'Text'}
                          </button>
                          <button
                            onClick={() => deleteUserDocument(user)}
                            disabled={updatingId === user.id}
                            className="p-2 text-rose-500 hover:text-rose-700 transition-colors"
                            title="Delete user document"
                          >
                            {updatingId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-20 text-center text-slate-500 font-medium">No users match the current filters.</div>
          )
        ) : activeTab === 'projects' ? (
          filteredProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Photo</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contact Fields</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProjects.map((project) => {
                    const isFlagged = hasSensitiveText(project.description) || hasSensitiveText(project.phone);
                    return (
                      <tr key={project.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-bold text-slate-900">{project.title}</p>
                          <p className="text-xs text-slate-500 font-medium">{project.category}</p>
                          <p className="mt-2 text-xs text-slate-500 max-w-xl line-clamp-2">{project.description || 'No description'}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-2">
                            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                              {project.photos?.[0] ? (
                                <img
                                  src={project.photos[0]}
                                  alt={project.title}
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <ImageIcon size={18} className="text-slate-400" />
                              )}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              {project.photoCount || 0} photos
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-medium text-slate-700">{project.phone || 'No phone'}</p>
                          <div className={cn(
                            'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                            isFlagged ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-green-50 text-green-600 border-green-100'
                          )}>
                            {isFlagged ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                            {isFlagged ? 'Needs Scrub' : 'Clean'}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-slate-100 text-slate-700">
                            {project.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => scrubProjectContact(project)}
                              disabled={updatingId === project.id}
                              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-blue-50 text-blue-700 border border-blue-100"
                            >
                              {updatingId === project.id ? <Loader2 size={14} className="animate-spin" /> : 'Scrub Contact'}
                            </button>
                            <button
                              onClick={() => deleteProject(project)}
                              disabled={updatingId === project.id}
                              className="p-2 text-rose-500 hover:text-rose-700 transition-colors"
                              title="Delete project"
                            >
                              {updatingId === project.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-20 text-center text-slate-500 font-medium">No projects match the current filters.</div>
          )
        ) : filteredReviews.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Review</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rating</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Moderation</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredReviews.map((review) => {
                  const isFlagged = hasSensitiveText(review.content);
                  return (
                    <tr key={review.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-900">{review.authorName}</p>
                        <p className="text-xs text-slate-500 font-medium">{review.projectName}</p>
                        <p className="mt-2 text-sm text-slate-600 max-w-2xl">{review.content}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-bold text-slate-700">{review.rating}/5</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                          isFlagged ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-green-50 text-green-600 border-green-100'
                        )}>
                          {isFlagged ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                          {isFlagged ? 'Needs Scrub' : 'Clean'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => scrubReviewContent(review)}
                            disabled={updatingId === review.id}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 bg-blue-50 text-blue-700 border border-blue-100"
                          >
                            {updatingId === review.id ? <Loader2 size={14} className="animate-spin" /> : 'Scrub Review'}
                          </button>
                          <button
                            onClick={() => deleteReview(review)}
                            disabled={updatingId === review.id}
                            className="p-2 text-rose-500 hover:text-rose-700 transition-colors"
                            title="Delete review"
                          >
                            {updatingId === review.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center text-slate-500 font-medium">No reviews match the current filters.</div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
