import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { 
  Briefcase, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  Clock,
  ChevronRight,
  MoreHorizontal,
  FileText,
  ShieldCheck,
  Zap,
  Loader2,
  X,
  MapPin,
  Hammer,
  Calculator,
  CalendarCheck,
  Camera,
  Plus,
  PlusCircle,
  Trash2,
  Image as ImageIcon,
  Database
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc, deleteDoc, orderBy, limit, getDoc } from 'firebase/firestore';
import { Project, Estimate } from '../types';
import { Toaster, toast } from 'sonner';

interface EstimateModalProps {
  project: Project;
  type: 'rough' | 'final';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function EstimateModal({ project, type, isOpen, onClose, onSuccess }: EstimateModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    setIsSubmitting(true);
    try {
      const estimate: Estimate = {
        contractorId: user.id,
        contractorName: user.name,
        amount: parseFloat(amount),
        submittedAt: new Date().toISOString(),
        type
      };

      const projectRef = doc(db, 'projects', project.id);
      const currentEstimates = type === 'rough' 
        ? (project.roughEstimates || []) 
        : (project.finalEstimates || []);
      
      if (currentEstimates.length >= 7) {
        toast.error(`Maximum of 7 ${type} estimates reached.`);
        return;
      }

      const updatedEstimates = [...currentEstimates, estimate];
      const updateData: any = {
        [type === 'rough' ? 'roughEstimates' : 'finalEstimates']: updatedEstimates,
        updatedAt: new Date().toISOString()
      };

      // Auto-update status based on estimates
      if (type === 'rough' && project.status === 'New Open Project') {
        updateData.status = 'Rough Estimates';
      } else if (type === 'final' && (project.status === 'Rough Estimates' || project.status === 'New Open Project')) {
        updateData.status = 'Final Estimates';
        // Set an expiration date for the "darkened/crossed out" logic (e.g., 7 days from now)
        updateData.expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      await updateDoc(projectRef, updateData);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} estimate submitted!`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error submitting estimate:", error);
      toast.error("Failed to submit estimate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8"
          >
            <h2 className="text-2xl font-black mb-6">Submit {type.charAt(0).toUpperCase() + type.slice(1)} Estimate</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Platform Agreement</p>
                <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
                  By submitting this bid, you agree to the Blueprint Home Solutions terms and guidelines and acknowledge that homeowner introductions originating on the platform must continue through the platform.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Estimate Amount ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="number" 
                    placeholder="0.00" 
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Submit'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const getProjectLocationLabel = (project: Project, hideExactAddress: boolean) => {
  const town = project.location?.town || (project.location as any)?.city || 'Unknown';
  const street = project.location?.street || '';

  if (hideExactAddress) {
    const streetWithoutNumber = street.replace(/^\s*\d+\s+/, '').trim();
    return [streetWithoutNumber || 'Project Area', town].filter(Boolean).join(', ');
  }

  return [street, town].filter(Boolean).join(', ');
};

export default function Projects() {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [contractorView, setContractorView] = useState<'projects' | 'contracts' | 'settings'>('projects');
  const [projectPhotos, setProjectPhotos] = useState<{id: string, url: string}[]>([]);
  const [estimateModal, setEstimateModal] = useState<{ isOpen: boolean; type: 'rough' | 'final'; project: Project | null }>({
    isOpen: false,
    type: 'rough',
    project: null
  });
  const [activeTab, setActiveTab] = useState('All');
  const { user } = useAuth();
  const isContractor = user?.role === 'Contractor';

  // Sync photos for projects that have photoCount > 0 but empty photos array
  useEffect(() => {
    if (!isContractor || projects.length === 0) return;

    const syncMissingPhotos = async () => {
      const projectsToSync = projects.filter(p => (p.photoCount || 0) > 0 && (!p.photos || p.photos.length === 0));
      if (projectsToSync.length === 0) return;

      console.log(`[Projects] Syncing photos for ${projectsToSync.length} projects`);
      
      for (const project of projectsToSync) {
        try {
          const photosRef = collection(db, 'projects', project.id, 'photos');
          const q = query(photosRef, orderBy('createdAt', 'asc'), limit(3));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const previewPhotos = snapshot.docs.map(d => d.data().url);
            await updateDoc(doc(db, 'projects', project.id), {
              photos: previewPhotos,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error(`[Projects] Failed to sync photos for project ${project.id}:`, err);
        }
      }
    };

    syncMissingPhotos();
  }, [projects, isContractor]);

  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(db, 'projects');
    // If contractor, show all projects (simplified for demo, in real app might be based on bids/assignments)
    // If homeowner, show only their projects
    const q = isContractor 
      ? query(projectsRef)
      : query(projectsRef, where('uid', '==', user.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Projects] Fetched ${snapshot.size} projects for user ${user.id}`);
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      projectsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setProjects(projectsData);
      setIsLoading(false);
    }, (error) => {
      console.error("[Projects] Error fetching projects:", error);
      handleFirestoreError(error, OperationType.GET, 'projects');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isContractor]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectPhotos([]);
      return;
    }

    const photosRef = collection(db, 'projects', selectedProject.id, 'photos');
    const q = query(photosRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photosData = snapshot.docs.map(doc => ({
        id: doc.id,
        url: doc.data().url
      }));
      setProjectPhotos(photosData);
    }, (error) => {
      console.error("[Projects] Error fetching project photos:", error);
    });

    return () => unsubscribe();
  }, [selectedProject]);

  useEffect(() => {
    const highlightedProjectId = location.state?.highlightProjectId;
    if (!highlightedProjectId || projects.length === 0) return;

    const matchedProject = projects.find(project => project.id === highlightedProjectId);
    if (!matchedProject) return;

    setActiveTab('All');
    setSelectedProject(matchedProject);
    setIsModalOpen(true);

    if (location.state?.projectSubmitted) {
      toast.success('Project submitted and added to My Projects.');
      window.history.replaceState({}, document.title);
    }
  }, [location.state, projects]);

  const handleScheduleAppointment = async (projectId: string) => {
    if (!selectedProject || isUpdating || !user) return;
    
    setIsUpdating(true);
    const projectRef = doc(db, 'projects', projectId);
    const inspectionDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // Default to 2 days from now

    try {
      const homeownerSnapshot = await getDoc(doc(db, 'users', selectedProject.uid));
      const homeownerData = homeownerSnapshot.exists() ? homeownerSnapshot.data() : null;

      const updateData: any = {
        inspectionDate,
        inspectionContractorId: user.id, // Track which contractor scheduled it
        updatedAt: new Date().toISOString()
      };

      if (selectedProject.status === 'New Open Project') {
        updateData.status = 'Rough Estimates';
      }

      await updateDoc(projectRef, updateData);
      await addDoc(collection(db, 'notifications'), {
        uid: selectedProject.uid,
        projectId,
        type: 'visit-request',
        title: 'New visit request',
        message: `${user.name} requested to schedule a visit for ${selectedProject.title}.`,
        createdAt: new Date().toISOString(),
        read: false
      });

      if (homeownerData?.email) {
        try {
          await fetch('/api/send-visit-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: homeownerData.email,
              homeownerName: homeownerData.name || 'Homeowner',
              contractorName: user.name,
              projectTitle: selectedProject.title,
              requestedVisitDate: inspectionDate
            })
          });
        } catch (emailError) {
          console.error("Failed to send visit request email:", emailError);
        }
      }

      setSelectedProject({ ...selectedProject, ...updateData });
      toast.success(`Visit request sent for ${new Date(inspectionDate).toLocaleDateString()}`);
    } catch (error) {
      console.error("Error scheduling appointment:", error);
      toast.error("Failed to send visit request");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject || !e.target.files || isUploading || !user) return;
    
    const files = Array.from(e.target.files) as File[];
    if (files.length === 0) return;

    setIsUploading(true);
    const projectRef = doc(db, 'projects', selectedProject.id);

    try {
      const newPhotoBase64s: string[] = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPhotoBase64s.push(base64);
      }

      // Save to subcollection
      await Promise.all(
        newPhotoBase64s.map(base64 => 
          addDoc(collection(db, 'projects', selectedProject.id, 'photos'), {
            url: base64,
            createdAt: new Date().toISOString(),
            uid: user.id
          })
        )
      );

      // Update project document's photoCount and preview photos
      const currentPhotos = selectedProject.photos || [];
      const updatedPreviewPhotos = [...currentPhotos, ...newPhotoBase64s].slice(0, 3);
      const newPhotoCount = (selectedProject.photoCount || 0) + newPhotoBase64s.length;

      await updateDoc(projectRef, {
        photos: updatedPreviewPhotos,
        photoCount: newPhotoCount,
        updatedAt: new Date().toISOString()
      });

      toast.success("Photos added successfully!");
    } catch (error) {
      console.error("Error adding photos:", error);
      toast.error("Failed to add photos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedProject || isUpdating) return;

    setIsUpdating(true);
    const photoRef = doc(db, 'projects', selectedProject.id, 'photos', photoId);
    const projectRef = doc(db, 'projects', selectedProject.id);

    try {
      await deleteDoc(photoRef);

      // Update project document's photoCount
      const newPhotoCount = Math.max(0, (selectedProject.photoCount || 0) - 1);
      
      // Update project document's preview photos
      const photosRef = collection(db, 'projects', selectedProject.id, 'photos');
      const q = query(photosRef, orderBy('createdAt', 'asc'), limit(3));
      const snapshot = await getDocs(q);
      const newPreviews = snapshot.docs.map(d => d.data().url);

      await updateDoc(projectRef, {
        photoCount: newPhotoCount,
        photos: newPreviews,
        updatedAt: new Date().toISOString()
      });

      toast.success("Photo removed");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to remove photo");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Bidding') {
      return ['New Open Project', 'Rough Estimates', 'Final Estimates'].includes(project.status);
    }
    if (activeTab === 'In Progress') {
      return ['In Contract', 'In Progress', 'On Hold'].includes(project.status);
    }
    if (activeTab === 'Completed') {
      return project.status === 'Completed';
    }
    return true;
  });

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight"></h1>
          {isContractor && (
            <p className="text-muted-foreground mt-1">Projects are automatically created when a homeowner agrees to hire you after an estimate.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-full md:w-auto">
            {['All', 'Bidding', 'In Progress', 'Completed'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                  activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          
          {isContractor && (
            <div className="h-8 w-px bg-slate-200 hidden md:block" />
          )}

          {isContractor && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button 
                onClick={() => setContractorView('projects')}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                  contractorView === 'projects' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <Briefcase size={14} />
                Projects
              </button>
              <button 
                onClick={() => setContractorView('contracts')}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                  contractorView === 'contracts' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <FileText size={14} />
                Contracts
              </button>
              <button 
                onClick={() => setContractorView('settings')}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                  contractorView === 'settings' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <Zap size={14} />
                Settings
              </button>
            </div>
          )}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {isContractor && contractorView === 'contracts' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="font-black text-xl">Global Contract Defaults</h2>
                <p className="text-sm text-slate-500 font-medium">Configure how your contracts and estimates behave by default</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Default Contract Type</label>
                <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none">
                  <option>Fixed Price (Lump Sum)</option>
                  <option>Cost-Plus Contract</option>
                  <option>Guaranteed Maximum Price (GMP)</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Required Contingency %</label>
                <div className="relative">
                  <input type="number" defaultValue="10" className="w-full pl-5 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none" />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">%</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Change Order Tracking</label>
                <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">Auto-Tracking</p>
                    <p className="text-[10px] text-slate-400 font-bold">Enabled</p>
                  </div>
                  <div className="ml-auto w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl shadow-slate-200/50">
              <h3 className="font-black text-lg mb-6">Contract Templates</h3>
              <div className="space-y-4">
                {[
                  { name: 'Standard Residential Renovation', type: 'Fixed Price', date: 'Mar 15, 2026' },
                  { name: 'Small Repair / Handyman Service', type: 'Time & Materials', date: 'Feb 28, 2026' },
                  { name: 'Commercial Fit-Out Agreement', type: 'Cost-Plus', date: 'Jan 10, 2026' }
                ].map((template, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-primary/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{template.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{template.type}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
                  </div>
                ))}
                <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:border-primary/50 hover:text-primary transition-all">
                  Create New Template
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl shadow-slate-200/50">
              <h3 className="font-black text-lg mb-6">Legal & Compliance</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-900">License Verified</p>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Active until Dec 2026</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-blue-900">Insurance Certificate</p>
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">General Liability - $2M</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {isContractor && contractorView === 'settings' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl shadow-slate-200/50"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <Zap size={24} />
            </div>
            <div>
              <h2 className="font-black text-xl">Contractor Settings</h2>
              <p className="text-sm text-slate-500 font-medium">Manage your profile and notification preferences</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <h3 className="font-black text-sm mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: 'New Project Alerts', desc: 'Get notified when new projects match your services', enabled: true },
                  { label: 'Estimate Reminders', desc: 'Reminders for rough and final estimates', enabled: true },
                  { label: 'Message Notifications', desc: 'Instant alerts for client messages', enabled: false }
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-700">{pref.label}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{pref.desc}</p>
                    </div>
                    <div className={cn(
                      "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                      pref.enabled ? "bg-primary" : "bg-slate-300"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                        pref.enabled ? "right-1" : "left-1"
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <h3 className="font-black text-sm mb-4">Service Area</h3>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].map((area) => (
                    <span key={area} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {area}
                    </span>
                  ))}
                  <button className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Plus size={10} /> Add Area
                  </button>
                </div>
              </div>
            </div>
            
            <div className="col-span-full bg-slate-50 rounded-[2rem] border border-slate-100 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg">Data Maintenance</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Keep your project previews in sync</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Sync Photo Previews</p>
                    <p className="text-xs text-slate-500 font-medium">Re-generate thumbnails for all your projects</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const projectsToSync = projects.filter(p => (p.photoCount || 0) > 0);
                    if (projectsToSync.length === 0) {
                      toast.info("No projects with photos to sync");
                      return;
                    }
                    toast.promise(
                      (async () => {
                        for (const project of projectsToSync) {
                          const photosRef = collection(db, 'projects', project.id, 'photos');
                          const q = query(photosRef, orderBy('createdAt', 'asc'), limit(3));
                          const snapshot = await getDocs(q);
                          if (!snapshot.empty) {
                            const previewPhotos = snapshot.docs.map(d => d.data().url);
                            await updateDoc(doc(db, 'projects', project.id), {
                              photos: previewPhotos,
                              updatedAt: new Date().toISOString()
                            });
                          }
                        }
                      })(),
                      {
                        loading: 'Syncing project photos...',
                        success: 'All project photos synchronized successfully!',
                        error: 'Failed to sync some photos. Please try again.'
                      }
                    );
                  }}
                  className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all"
                >
                  Run Sync
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {(!isContractor || contractorView === 'projects') && (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Preview</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Project Details</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estimates</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => {
                      const isExpired = project.expirationDate && new Date(project.expirationDate) < new Date();
                      const locationLabel = getProjectLocationLabel(project, isContractor);

                      return (
                        <tr 
                          key={project.id} 
                          onClick={() => {
                            setSelectedProject(project);
                            setIsModalOpen(true);
                          }}
                          className={cn(
                            "group hover:bg-slate-50/40 transition-all cursor-pointer border-b border-slate-50",
                            isExpired && "opacity-50 grayscale"
                          )}
                        >
                          <td className="px-8 py-6">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm group-hover:shadow-md transition-all">
                              {project.photos && project.photos.length > 0 ? (
                                <img src={project.photos[0]} className="w-full h-full object-cover" alt="Preview" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                  <ImageIcon size={20} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-slate-200">
                                  {project.category}
                                </span>
                              </div>
                              <p className="font-black text-slate-900 text-base leading-tight group-hover:text-primary transition-colors">{project.title}</p>
                              <div className="flex items-center gap-2">
                                <MapPin size={10} className="text-primary" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{locationLabel}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="space-y-3">
                              <div className="flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Final Bid</span>
                                  <span className="text-[10px] font-black text-emerald-500">
                                    {project.finalEstimates?.length || 0}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-slate-900">
                                  {project.finalEstimates && project.finalEstimates.length > 0 
                                    ? `$${Math.max(...project.finalEstimates.map((e: any) => e.amount)).toLocaleString()}`
                                    : 'NONE'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rough Bid</span>
                                  <span className="text-[10px] font-black text-primary">
                                    {project.roughEstimates?.length || 0}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-slate-500">
                                  {project.roughEstimates && project.roughEstimates.length > 0
                                    ? `$${Math.max(...project.roughEstimates.map((e: any) => e.amount)).toLocaleString()}`
                                    : 'NONE'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={cn(
                              "text-[10px] font-black px-4 py-2 rounded-2xl uppercase tracking-[0.1em] inline-block shadow-sm border",
                              isExpired ? "bg-red-50 text-red-600 border-red-100" :
                              project.status === 'In Progress' ? "bg-blue-50 text-blue-600 border-blue-100" : 
                              project.status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                              ((project.roughEstimates?.length || 0) > 0 || (project.finalEstimates?.length || 0) > 0) ? "bg-amber-50 text-amber-600 border-amber-100" :
                              project.status === 'New Open Project' ? "bg-purple-50 text-purple-600 border-purple-100 animate-pulse" :
                              "bg-slate-50 text-slate-500 border-slate-100"
                            )}>
                              {isExpired ? 'Expired' : 
                               ((project.roughEstimates?.length || 0) > 0 || (project.finalEstimates?.length || 0) > 0) ? 'Taking Bids' :
                               project.status === 'New Open Project' ? 'New' : 
                               project.status}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            {isContractor ? (
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEstimateModal({ isOpen: true, type: 'rough', project: project });
                                  }}
                                  className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all border border-slate-100"
                                  title="Submit Rough Estimate"
                                >
                                  <PlusCircle size={20} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEstimateModal({ isOpen: true, type: 'final', project: project });
                                  }}
                                  className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100"
                                  title="Submit Final Estimate"
                                >
                                  <PlusCircle size={20} className="rotate-45" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject(project);
                                  setIsModalOpen(true);
                                }}
                                className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-slate-900/10 hover:shadow-primary/20 active:scale-95"
                              >
                                View Details
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-32 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-slate-100 shadow-inner">
                            <Briefcase size={40} className="text-slate-300" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-900 mb-3">{isContractor ? 'No projects found' : 'No projects yet'}</h3>
                          {isContractor && (
                            <p className="text-slate-500 font-medium max-w-sm mx-auto mb-10">
                              You haven't been assigned to any projects yet. Projects will appear here once homeowners select you for their home improvements.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Project Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
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
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className={cn(
                      "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                      selectedProject.status === 'New Open Project' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {selectedProject.status}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedProject.title}</h2>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                {/* Photos Section */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                        <Camera size={20} />
                      </div>
                      <h3 className="font-black text-lg text-slate-900">Project Gallery</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{projectPhotos.length} Photos</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {projectPhotos.map((photo) => (
                      <div key={photo.id} className="relative aspect-square rounded-[2rem] overflow-hidden border border-slate-200 group/img shadow-sm hover:shadow-xl transition-all">
                        <img 
                          src={photo.url} 
                          alt="Project photo" 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        {!isContractor && (
                          <button 
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="absolute top-4 right-4 w-10 h-10 bg-red-500 text-white rounded-2xl opacity-0 group-hover/img:opacity-100 transition-all shadow-xl flex items-center justify-center hover:scale-110 active:scale-90"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                    {!isContractor && projectPhotos.length < 15 && (
                      <label className="aspect-square rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:border-primary/50 transition-all group/add">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover/add:bg-primary/10 group-hover/add:text-primary transition-all">
                          <Plus size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/add:text-primary">Add Photo</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleAddPhotos}
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>
                  {projectPhotos.length === 0 && isContractor && (
                    <div className="p-12 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-center">
                      <ImageIcon size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No photos uploaded by homeowner yet</p>
                    </div>
                  )}
                </section>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Budget</p>
                    <p className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <DollarSign size={20} className="text-emerald-500" />
                      {selectedProject.budget.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Start Date</p>
                    <p className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <Calendar size={20} className="text-blue-500" />
                      {selectedProject.startDate}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Photos</p>
                    <p className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <Camera size={20} className="text-purple-500" />
                      {selectedProject.photoCount || 0}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <p className="text-xl font-black text-slate-900">{selectedProject.status === 'New Open Project' ? 'New' : selectedProject.status}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
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
                        {isContractor ? (
                          <>
                            <p className="text-base font-bold text-slate-600">
                              {getProjectLocationLabel(selectedProject, true)}
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                              Address hidden until estimate accepted by homeowner
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-base font-bold text-slate-600">{selectedProject.location.street}</p>
                            <p className="text-base font-bold text-slate-600">{selectedProject.location.town}, {selectedProject.location.zip}</p>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                              Your full address stays private until you accept a rough bid and request an in-person inspection for a final estimate.
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="pl-13 text-sm text-slate-400 italic font-medium">No location provided</p>
                    )}
                  </section>

                  {selectedProject.inspectionDate && (
                    <section className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                          <CalendarCheck size={20} />
                        </div>
                        <h3 className="font-black text-lg text-emerald-900">Inspection Scheduled</h3>
                      </div>
                      <div className="pl-13">
                        <p className="text-lg font-black text-emerald-700">
                          {new Date(selectedProject.inspectionDate).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
                        </p>
                        <p className="text-xs text-emerald-600/70 mt-1 font-bold uppercase tracking-wider">Inspection requested through the platform</p>
                      </div>
                    </section>
                  )}

                  {isContractor && selectedProject.status === 'New Open Project' && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <button 
                          onClick={() => {
                            setEstimateModal({ isOpen: true, type: 'rough', project: selectedProject });
                            setIsModalOpen(false);
                          }}
                          className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-100 transition-all shadow-sm text-left"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Submit your</span>
                            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                              <Calculator size={16} className="text-primary" />
                              Rough Estimate
                            </span>
                          </div>
                        </button>
                        <button 
                          onClick={() => handleScheduleAppointment(selectedProject.id)}
                          disabled={isUpdating}
                          className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-50 shadow-sm text-left"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Request to</span>
                            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                              <CalendarCheck size={16} className="text-primary" />
                              {isUpdating ? 'Send Inspection Request' : 'Schedule Inspection'}
                            </span>
                          </div>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Bid Notice</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
                          Submitting a bid means you agree to the Blueprint terms, platform rules, and compensation guidelines for homeowner introductions that begin here.
                        </p>
                      </div>
                    </>
                  )}

                  <div className="pt-2">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EstimateModal 
        isOpen={estimateModal.isOpen}
        type={estimateModal.type}
        project={estimateModal.project!}
        onClose={() => setEstimateModal({ ...estimateModal, isOpen: false })}
        onSuccess={() => {
          // Success handled in modal
        }}
      />
    </div>
  );
}
