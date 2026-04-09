import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Hammer,
  ArrowRight,
  Loader2,
  Image as ImageIcon,
  X,
  Camera,
  Calendar,
  FileText,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs, limit, updateDoc, doc, getDoc } from 'firebase/firestore';
import { USER_PROFILES_COLLECTION, USERS_COLLECTION } from '../lib/userDocuments';
import { LeadInquiry, Project, Estimate } from '../types';
import { cn } from '../lib/utils';
import { Toaster, toast } from 'sonner';

function inquiryStatusBadgeClass(status: LeadInquiry['status']) {
  if (status === 'Requested') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'Admin Reviewing') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'Homeowner Contact Pending') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (status === 'Homeowner Confirmed') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (status === 'Introduction Approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Declined') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-200 text-slate-700 border-slate-300';
}

export default function HomeownerDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectPhotos, setProjectPhotos] = useState<{ id: string; url: string }[]>([]);
  const [introSummaries, setIntroSummaries] = useState<Record<string, LeadInquiry[]>>({});
  const [acceptingEstimateKey, setAcceptingEstimateKey] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'projects'),
      where('uid', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];

      const hydratedProjects = await Promise.all(
        projectsData.map(async (project) => {
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
            console.error('[HomeownerDashboard] Failed to sync project preview photos:', syncError);
            return project;
          }
        })
      );

      setProjects(hydratedProjects);
      setError('');
      setIsLoading(false);
    }, (error) => {
      console.error('[HomeownerDashboard] Error fetching projects:', error);
      setError('We could not load your account activity right now. Please refresh and try again.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectPhotos([]);
      return;
    }

    const photosRef = collection(db, 'projects', selectedProject.id, 'photos');
    const photosQuery = query(photosRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(photosQuery, (snapshot) => {
      const photosData = snapshot.docs.map((photoDoc) => ({
        id: photoDoc.id,
        url: photoDoc.data().url,
      }));

      if (photosData.length === 0 && selectedProject.photos?.length) {
        setProjectPhotos(
          selectedProject.photos.map((url, index) => ({
            id: `preview-${index}`,
            url,
          }))
        );
        return;
      }

      setProjectPhotos(photosData);
    });

    return () => unsubscribe();
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    const refreshedProject = projects.find((project) => project.id === selectedProject.id);
    if (refreshedProject) {
      setSelectedProject(refreshedProject);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (!user || projects.length === 0) {
      setIntroSummaries({});
      return;
    }

    const loadInquirySummaries = async () => {
      try {
        const grouped: Record<string, LeadInquiry[]> = {};
        const chunks: string[][] = [];
        for (let index = 0; index < projects.length; index += 10) {
          chunks.push(projects.slice(index, index + 10).map((project) => project.id));
        }

        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          const snapshot = await getDocs(
            query(collection(db, 'lead_inquiries'), where('leadId', 'in', chunk))
          );

          for (const entry of snapshot.docs) {
            const inquiry = {
              id: entry.id,
              ...(entry.data() as Omit<LeadInquiry, 'id'>),
            };
            grouped[inquiry.leadId] = [...(grouped[inquiry.leadId] || []), inquiry].sort(
              (left, right) =>
                new Date(right.updatedAt || right.createdAt).getTime() -
                new Date(left.updatedAt || left.createdAt).getTime()
            );
          }
        }

        setIntroSummaries(grouped);
      } catch (inquiryError) {
        console.error('[HomeownerDashboard] Error loading intro summaries:', inquiryError);
      }
    };

    void loadInquirySummaries();
  }, [projects, user]);

  const activeProjects = projects.filter((p) =>
    ['New Open Project', 'Rough Estimates', 'Final Estimates', 'In Contract', 'In Progress', 'On Hold'].includes(p.status)
  );
  const sortedProjects = [...activeProjects].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const getProjectPhaseLabel = (project: Project) => {
    if (project.status === 'New Open Project') return 'New';
    if (project.status === 'Rough Estimates') {
      const count = project.roughEstimates?.length || 0;
      if (count === 1) return '1 bid received';
      if (count > 1) return `${count} estimates received`;
      return 'Estimate requested';
    }
    if (project.status === 'Final Estimates') {
      const count = project.finalEstimates?.length || 0;
      if (count === 1) return '1 final estimate received';
      if (count > 1) return `${count} final estimates received`;
      return 'Final estimate received';
    }
    if (project.status === 'In Contract') {
      return project.inspectionDate
        ? `Work started ${new Date(project.inspectionDate).toLocaleDateString()}`
        : 'Work started';
    }
    if (project.status === 'In Progress') return 'Work in progress';
    if (project.status === 'On Hold') return 'On hold';
    if (project.status === 'Completed') {
      return project.endDate
        ? `Finished ${new Date(project.endDate).toLocaleDateString()}`
        : 'Work finished';
    }
    return project.status;
  };
  const getEstimateSummary = (project: Project) => {
    const roughCount = project.roughEstimates?.length || 0;
    const finalCount = project.finalEstimates?.length || 0;

    if (finalCount > 0) {
      return `${finalCount} final estimate${finalCount === 1 ? '' : 's'}`;
    }

    if (roughCount > 0) {
      return `${roughCount} estimate${roughCount === 1 ? '' : 's'}`;
    }

    return 'No estimates yet';
  };

  const getIntroSummaryLabel = (projectId: string) => {
    const projectInquiries = introSummaries[projectId] || [];
    if (projectInquiries.some((entry) => entry.status === 'Introduction Approved')) {
      return 'Introduction approved';
    }
    if (projectInquiries.some((entry) => entry.status === 'Homeowner Confirmed')) {
      return 'Homeowner confirmed';
    }
    if (projectInquiries.some((entry) => entry.status === 'Homeowner Contact Pending')) {
      return 'Vendor interest under review';
    }
    if (projectInquiries.some((entry) => entry.status === 'Admin Reviewing')) {
      return 'Blueprint reviewing vendor interest';
    }
    if (projectInquiries.some((entry) => entry.status === 'Requested')) {
      return 'Vendor interest received';
    }
    if (projectInquiries.some((entry) => entry.status === 'Declined')) {
      return 'A request was declined';
    }
    return 'No contractor introductions yet';
  };

  const getIntroSummaryMeta = (projectId: string) => {
    const projectInquiries = introSummaries[projectId] || [];
    if (projectInquiries.length === 0) {
      return 'No Home Pro has requested an introduction for this project yet.';
    }

    const latestInquiry = projectInquiries[0];
    const requestedCount = projectInquiries.filter((entry) =>
      ['Requested', 'Admin Reviewing', 'Homeowner Contact Pending', 'Homeowner Confirmed'].includes(entry.status)
    ).length;

    if (latestInquiry.status === 'Introduction Approved') {
      return 'Blueprint approved a shared introduction and kept the thread coordinated through email.';
    }
    if (latestInquiry.status === 'Declined') {
      return 'Blueprint reviewed at least one request and declined it.';
    }
    if (requestedCount > 1) {
      return `${requestedCount} contractor requests are moving through Blueprint review.`;
    }

    return 'Blueprint is coordinating contractor interest before releasing any direct introduction.';
  };

  const formatTimestamp = (value?: string) => {
    if (!value) return 'Not yet';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const acceptEstimate = async (project: Project, estimate: Estimate) => {
    if (!user) return;

    const estimateType = estimate.type;
    const estimateKey = `${project.id}-${estimateType}-${estimate.contractorId}-${estimate.submittedAt}`;
    setAcceptingEstimateKey(estimateKey);

    try {
      const [contractorSnapshot, contractorProfileSnapshot] = await Promise.all([
        getDoc(doc(db, USERS_COLLECTION, estimate.contractorId)),
        getDoc(doc(db, USER_PROFILES_COLLECTION, estimate.contractorId)),
      ]);
      const contractorData = contractorSnapshot.exists() ? contractorSnapshot.data() : null;
      const contractorProfile = contractorProfileSnapshot.exists() ? contractorProfileSnapshot.data() : null;
      const contractorEmail = typeof contractorData?.email === 'string' ? contractorData.email : '';
      const contractorName = contractorProfile?.name || estimate.contractorName;

      const nextStatus = estimateType === 'final' ? 'In Contract' : 'Final Estimates';
      const updatePayload: Partial<Project> & { updatedAt: string } = {
        selectedContractorId: estimate.contractorId,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'projects', project.id), updatePayload);

      if (contractorEmail) {
        const response = await fetch('/api/send-estimate-accepted-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeownerEmail: user.email,
            homeownerName: user.name,
            contractorEmail,
            contractorName,
            projectTitle: project.title,
            amount: estimate.amount,
            estimateType,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          console.error('Estimate acceptance notification failed:', payload?.error || response.statusText);
        }
      }

      setProjects((current) =>
        current.map((entry) =>
          entry.id === project.id
            ? { ...entry, ...updatePayload }
            : entry
        )
      );
      setSelectedProject((current) =>
        current?.id === project.id
          ? { ...current, ...updatePayload }
          : current
      );

      toast.success(
        estimateType === 'final'
          ? 'Final estimate accepted. Homeowner, contractor, and admin were notified.'
          : 'Rough estimate accepted. Everyone has been notified to move toward inspection and final estimate.'
      );
    } catch (acceptError) {
      console.error('[HomeownerDashboard] Failed to accept estimate:', acceptError);
      toast.error('Could not accept that estimate right now.');
    } finally {
      setAcceptingEstimateKey('');
    }
  };

  const renderEstimateCards = (project: Project, estimates: Estimate[] | undefined, type: 'rough' | 'final') => {
    if (!estimates || estimates.length === 0) {
      return (
        <p className="text-sm text-slate-500">
          No {type} estimates received yet.
        </p>
      );
    }

    const sortedEstimates = [...estimates].sort(
      (left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
    );

    return (
      <div className="space-y-3">
        {sortedEstimates.map((estimate) => {
          const estimateKey = `${project.id}-${type}-${estimate.contractorId}-${estimate.submittedAt}`;
          const isAccepted = project.selectedContractorId === estimate.contractorId &&
            ((type === 'rough' && ['Final Estimates', 'In Contract', 'In Progress'].includes(project.status)) ||
              (type === 'final' && ['In Contract', 'In Progress'].includes(project.status)));

          return (
            <div key={estimateKey} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">{estimate.contractorName}</p>
                  <p className="text-sm font-medium text-slate-600">${estimate.amount.toLocaleString()}</p>
                  <p className="text-[11px] font-medium text-slate-500">
                    Submitted {new Date(estimate.submittedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isAccepted ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Accepted
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!!acceptingEstimateKey}
                      onClick={() => void acceptEstimate(project, estimate)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-50"
                    >
                      {acceptingEstimateKey === estimateKey ? 'Saving...' : `Accept ${type} estimate`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getInquiryStatusDetail = (inquiry: LeadInquiry) => {
    if (inquiry.status === 'Introduction Approved') {
      return 'Blueprint approved this introduction and opened the shared email thread.';
    }
    if (inquiry.status === 'Homeowner Confirmed') {
      return 'Blueprint recorded that you are open to this introduction and can move forward.';
    }
    if (inquiry.status === 'Homeowner Contact Pending') {
      return 'Blueprint is actively reviewing contractor interest and may contact you before any introduction is released.';
    }
    if (inquiry.status === 'Admin Reviewing') {
      return 'Blueprint is evaluating this contractor request for fit and readiness.';
    }
    if (inquiry.status === 'Declined') {
      return inquiry.declineReason
        ? `Blueprint declined this request: ${inquiry.declineReason}`
        : 'Blueprint declined this introduction request.';
    }
    if (inquiry.status === 'Closed') {
      return 'Blueprint closed this request and no further action is expected.';
    }
    return 'A Home Pro has requested an introduction through Blueprint.';
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Toaster position="top-right" richColors />
      <div className="mb-4">
        <h1 className="text-3xl font-black tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground mt-1 font-medium">Manage your home improvement journey</p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Homeowner Account</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Keep track of your requests in one place</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Your Blueprint account keeps a record of submitted improvements, project updates, and future requests whenever you need them.
            </p>
          </div>
          <Link
            to="/select-improvement"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.02]"
          >
            <Plus size={18} />
            Start New Improvement
          </Link>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">My Account Details</p>
            <div className="space-y-1">
              <p className="text-lg font-black text-slate-900">{user?.name || 'No name saved'}</p>
              <p className="text-sm font-medium text-slate-600">{user?.email || 'No email saved'}</p>
              <p className="text-sm font-medium text-slate-600">{user?.phone || 'No phone saved yet'}</p>
              <p className="text-sm font-medium text-slate-600">
                {[user?.street, user?.town, user?.zip].filter(Boolean).join(', ') || 'No address saved yet'}
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-50"
          >
            Update Account Details
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-lg">Current Project Requests</h3>
        </div>
        {sortedProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Preview</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Project</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Estimates</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Intro Activity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedProjects.map((project) => {
                  return (
                    <tr
                      key={project.id}
                      className="cursor-pointer hover:bg-slate-50/60 transition-colors"
                      onClick={() => setSelectedProject(project)}
                    >
                      <td className="px-6 py-5">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                          {project.photos?.[0] ? (
                            <img src={project.photos[0]} alt={project.title} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon size={18} className="text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">{project.title}</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-700">{getEstimateSummary(project)}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">{getIntroSummaryLabel(project.id)}</p>
                          <p className="text-xs font-medium text-slate-500">
                            {(introSummaries[project.id] || []).length} request{(introSummaries[project.id] || []).length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-700">{getProjectPhaseLabel(project)}</p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedProject(project);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white"
                        >
                          View
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
              <Hammer size={24} />
            </div>
            <h4 className="font-bold text-slate-900">No active projects</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px]">Start your next home improvement from your account whenever you are ready.</p>
            <Link
              to="/select-improvement"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white"
            >
              Start New Improvement
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProject(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative ml-auto h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{selectedProject.category}</span>
                    <span className={cn(
                      'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest',
                      selectedProject.status === 'New Open Project' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    )}>
                      {getProjectPhaseLabel(selectedProject)}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedProject.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                        <Camera size={20} />
                      </div>
                      <h3 className="font-black text-lg text-slate-900">Project Gallery</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      {projectPhotos.length || selectedProject.photoCount || 0} Photos
                    </span>
                  </div>

                  {projectPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {projectPhotos.map((photo) => (
                        <div key={photo.id} className="aspect-square rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm">
                          <img
                            src={photo.url}
                            alt="Project photo"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-center">
                      <ImageIcon size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No photos uploaded yet</p>
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Requested</p>
                    <p className="text-lg font-black text-slate-900">
                      {selectedProject.createdAt ? new Date(selectedProject.createdAt).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Start Timeline</p>
                    <p className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Calendar size={18} className="text-blue-500" />
                      {selectedProject.startDate || 'Not set'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Estimates</p>
                    <p className="text-lg font-black text-slate-900">{getEstimateSummary(selectedProject)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Status</p>
                    <p className="text-lg font-black text-slate-900">{getProjectPhaseLabel(selectedProject)}</p>
                  </div>
                </div>

                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <FileText size={20} />
                    </div>
                    <h3 className="font-black text-lg text-slate-900">Estimates</h3>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rough Estimates</p>
                      <div className="mt-4">
                        {renderEstimateCards(selectedProject, selectedProject.roughEstimates, 'rough')}
                      </div>
                    </div>
                    <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Final Estimates</p>
                      <div className="mt-4">
                        {renderEstimateCards(selectedProject, selectedProject.finalEstimates, 'final')}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <FileText size={20} />
                    </div>
                    <h3 className="font-black text-lg text-slate-900">Introduction Activity</h3>
                  </div>
                  <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                    <p className="text-sm font-bold text-slate-900">{getIntroSummaryLabel(selectedProject.id)}</p>
                    <p className="mt-2 text-sm text-slate-600">{getIntroSummaryMeta(selectedProject.id)}</p>
                    {(introSummaries[selectedProject.id] || []).length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {(introSummaries[selectedProject.id] || []).slice(0, 4).map((inquiry) => (
                          <div key={inquiry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-bold text-slate-900">{inquiry.contractorName}</p>
                              <span className={cn(
                                'inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                inquiryStatusBadgeClass(inquiry.status)
                              )}>
                                {inquiry.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{getInquiryStatusDetail(inquiry)}</p>
                            <div className="mt-3 grid gap-2 text-[11px] font-medium text-slate-500 md:grid-cols-2">
                              <p>Requested: {formatTimestamp(inquiry.createdAt)}</p>
                              <p>Updated: {formatTimestamp(inquiry.statusUpdatedAt || inquiry.updatedAt || inquiry.createdAt)}</p>
                              <p>Last Communication: {formatTimestamp(inquiry.lastCommunicationAt)}</p>
                              <p>Homeowner Confirmed: {formatTimestamp(inquiry.homeownerConfirmedAt)}</p>
                              {inquiry.introductionThreadId && <p>Thread Ready: {inquiry.introductionThreadId}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No contractor has requested an introduction for this project yet.
                      </p>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <FileText size={20} />
                    </div>
                    <h3 className="font-black text-lg text-slate-900">Project Description</h3>
                  </div>
                  <p className="pl-13 text-base font-medium leading-7 text-slate-600">
                    {selectedProject.description || 'No project description provided.'}
                  </p>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <MapPin size={20} />
                    </div>
                    <h3 className="font-black text-lg text-slate-900">Project Location</h3>
                  </div>
                  {selectedProject.location ? (
                    <div className="pl-13 space-y-1">
                      <p className="text-base font-bold text-slate-600">{selectedProject.location.street || 'No street saved'}</p>
                      <p className="text-base font-bold text-slate-600">
                        {[selectedProject.location.town, selectedProject.location.zip].filter(Boolean).join(', ') || 'No town or zip saved'}
                      </p>
                    </div>
                  ) : (
                    <p className="pl-13 text-sm text-slate-400 italic font-medium">No location provided</p>
                  )}
                </section>

                <div className="pt-2">
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
