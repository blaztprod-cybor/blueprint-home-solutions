import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle,
  User as UserIcon,
  Mail,
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { User, Project } from '../types';
import { cn } from '../lib/utils';

const AdminDashboard = () => {
  const [contractors, setContractors] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'contractors' | 'projects'>('contractors');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified' | 'active' | 'completed'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'contractors') {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'Contractor')
        );
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setContractors(docs.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } else {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[];
        setProjects(docs);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      const newStatus = !currentStatus;
      await updateDoc(userRef, {
        isVerified: newStatus,
        licenseStatus: newStatus ? 'Active' : 'Pending',
        updatedAt: new Date().toISOString()
      });
      
      setContractors(prev => prev.map(c => 
        c.id === userId ? { ...c, isVerified: newStatus, licenseStatus: newStatus ? 'Active' : 'Pending' } : c
      ));
    } catch (error) {
      console.error('Error updating verification status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateLicenseStatus = async (userId: string, status: User['licenseStatus']) => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        licenseStatus: status,
        isVerified: status === 'Active',
        updatedAt: new Date().toISOString()
      });
      
      setContractors(prev => prev.map(c => 
        c.id === userId ? { ...c, licenseStatus: status, isVerified: status === 'Active' } : c
      ));
    } catch (error) {
      console.error('Error updating license status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    
    setUpdatingId(projectId);
    try {
      const projectRef = doc(db, 'projects', projectId);
      // In a real app, we might want to delete photos from storage too
      await updateDoc(projectRef, { status: 'Deleted', updatedAt: new Date().toISOString() });
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredContractors = contractors.filter(c => {
    const matchesSearch = (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filter === 'all' || 
                         (filter === 'verified' && c.isVerified) || 
                         (filter === 'unverified' && !c.isVerified);
    return matchesSearch && matchesFilter;
  });

  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' && p.status !== 'Completed') || 
                         (filter === 'completed' && p.status === 'Completed');
    return matchesSearch && matchesFilter;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-muted-foreground font-medium mt-1">Manage system resources and verification</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('contractors')}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-sm font-bold transition-all",
              activeTab === 'contractors' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-slate-600 border border-slate-200"
            )}
          >
            Contractors
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-sm font-bold transition-all",
              activeTab === 'projects' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-slate-600 border border-slate-200"
            )}
          >
            Projects
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeTab === 'contractors' ? (
          <>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pros</p>
                <p className="text-2xl font-black text-slate-900">{contractors.length}</p>
              </div>
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
            </div>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified</p>
                <p className="text-2xl font-black text-slate-900">{contractors.filter(c => c.isVerified).length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                <p className="text-2xl font-black text-slate-900">{contractors.filter(c => !c.isVerified).length}</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Projects</p>
                <p className="text-2xl font-black text-slate-900">{projects.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <Calendar size={20} />
              </div>
            </div>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</p>
                <p className="text-2xl font-black text-slate-900">{projects.filter(p => p.status !== 'Completed').length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Loader2 size={20} />
              </div>
            </div>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completed</p>
                <p className="text-2xl font-black text-slate-900">{projects.filter(p => p.status === 'Completed').length}</p>
              </div>
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            placeholder={activeTab === 'contractors' ? "Search by name or email..." : "Search by project title or category..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
          />
        </div>
        <div className="flex gap-2">
          {activeTab === 'contractors' ? (
            (['all', 'verified', 'unverified'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 px-4 py-3 rounded-2xl text-sm font-bold capitalize transition-all",
                  filter === f 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f}
              </button>
            ))
          ) : (
            (['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 px-4 py-3 rounded-2xl text-sm font-bold capitalize transition-all",
                  filter === f 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Content List */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fetching Data...</p>
          </div>
        ) : activeTab === 'contractors' ? (
          filteredContractors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contractor</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">License Info</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contact</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredContractors.map((contractor) => (
                    <tr key={contractor.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                            <img 
                              src={contractor.avatar} 
                              alt={contractor.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{contractor.name}</p>
                            <p className="text-xs text-muted-foreground font-medium">ID: {contractor.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">{contractor.licenseNumber || 'No License'}</p>
                          <select 
                            value={contractor.licenseStatus || 'Pending'}
                            onChange={(e) => updateLicenseStatus(contractor.id, e.target.value as any)}
                            disabled={updatingId === contractor.id}
                            className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider border bg-white",
                              contractor.licenseStatus === 'Active' ? "text-emerald-600 border-emerald-100" :
                              contractor.licenseStatus === 'Expired' ? "text-red-600 border-red-100" :
                              contractor.licenseStatus === 'Invalid' ? "text-rose-600 border-rose-100" :
                              "text-amber-600 border-amber-100"
                            )}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Active">Active</option>
                            <option value="Expired">Expired</option>
                            <option value="Invalid">Invalid</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        {contractor.isVerified ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-100">
                            <ShieldCheck size={14} />
                            Verified
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-100">
                            <ShieldAlert size={14} />
                            Unverified
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Mail size={14} className="text-slate-400" />
                            {contractor.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => toggleVerification(contractor.id, !!contractor.isVerified)}
                          disabled={updatingId === contractor.id}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50",
                            contractor.isVerified
                              ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                              : "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/20"
                          )}
                        >
                          {updatingId === contractor.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : contractor.isVerified ? (
                            "Revoke Verification"
                          ) : (
                            "Verify Pro"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No contractors found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                Try adjusting your search or filter to find what you're looking for.
              </p>
            </div>
          )
        ) : (
          filteredProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estimates</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                            <img 
                              src={project.imageUrl || `https://picsum.photos/seed/${project.id}/100/100`} 
                              alt={project.title} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{project.title}</p>
                            <p className="text-xs text-muted-foreground font-medium">{project.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                          project.status === 'In Progress' ? "bg-blue-100 text-blue-700" : 
                          project.status === 'Completed' ? "bg-emerald-100 text-emerald-700" : 
                          "bg-amber-100 text-amber-700"
                        )}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-bold text-slate-600">
                          {project.roughEstimates?.length || 0} Rough / {project.finalEstimates?.length || 0} Final
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => deleteProject(project.id)}
                            disabled={updatingId === project.id}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                            title="Delete Project"
                          >
                            {updatingId === project.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No projects found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                Try adjusting your search or filter to find what you're looking for.
              </p>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
