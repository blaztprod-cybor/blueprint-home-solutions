import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { Project, User } from '../types';
import { cn } from '../lib/utils';

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
  isDisabled?: boolean;
};

type AdminProject = Project & {
  contactSanitized?: boolean;
};

type AdminTab = 'users' | 'projects' | 'reviews';
type AdminFilter = 'all' | 'verified' | 'unverified' | 'active' | 'completed' | 'flagged';

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

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [filter, setFilter] = useState<AdminFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersSnapshot, projectsSnapshot, reviewsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'))),
        getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))),
      ]);

      const userDocs = usersSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })) as AdminUser[];

      const projectDocs = projectsSnapshot.docs.map((entry) => {
        const data = entry.data() as AdminProject;
        return {
          id: entry.id,
          ...data,
          contactSanitized: !hasSensitiveText(data.description) && !hasSensitiveText(data.phone),
        };
      }) as AdminProject[];

      const reviewDocs = reviewsSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })) as Review[];

      setUsers(userDocs.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setProjects(projectDocs);
      setReviews(reviewDocs);
    } catch (error) {
      console.error('Error fetching admin data:', error);
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

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = [user.name, user.email, user.licenseNumber, user.role]
        .some((value) => String(value || '').toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter =
        filter === 'all' ||
        (filter === 'verified' && !!user.isVerified) ||
        (filter === 'unverified' && !user.isVerified);
      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, filter]);

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

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      const nextStatus = !currentStatus;
      await updateDoc(userRef, {
        isVerified: nextStatus,
        licenseStatus: nextStatus ? 'Active' : 'Pending',
        updatedAt: new Date().toISOString(),
      });
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
      await updateDoc(doc(db, 'users', user.id), {
        isDisabled: nextValue,
        updatedAt: new Date().toISOString(),
      });
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, isDisabled: nextValue } : entry))
      );
    } catch (error) {
      console.error('Error toggling user disabled state:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteUserDocument = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Delete the Firestore account record for ${user.name || user.email || user.id}? This does not remove Firebase Auth credentials.`
    );
    if (!confirmed) return;

    setUpdatingId(user.id);
    try {
      await deleteDoc(doc(db, 'users', user.id));
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
        activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-600 border border-slate-200'
      )}
    >
      {label}
    </button>
  );

  const filterOptions: AdminFilter[] =
    activeTab === 'users'
      ? ['all', 'verified', 'unverified']
      : activeTab === 'projects'
        ? ['all', 'active', 'completed', 'flagged']
        : ['all', 'flagged'];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Moderate users, projects, and reviews from one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
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
        <div className="flex gap-2">
          {filterOptions.map((entry) => (
            <button
              key={entry}
              onClick={() => setFilter(entry)}
              className={cn(
                'flex-1 px-4 py-3 rounded-2xl text-sm font-bold capitalize transition-all',
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

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fetching Data...</p>
          </div>
        ) : activeTab === 'users' ? (
          filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">User</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role / License</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verification</th>
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
                        <p className="text-sm font-bold text-slate-700">{user.role}</p>
                        <p className="text-xs text-slate-500 font-medium">{user.licenseNumber || 'No License Number'}</p>
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
