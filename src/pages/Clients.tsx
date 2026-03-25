import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Search, 
  MapPin,
  Filter,
  Download,
  Loader2,
  Calendar,
  Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Project } from '../types';

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [homeownerDetails, setHomeownerDetails] = useState<Record<string, { name: string, email: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Filter projects where this contractor has a scheduled inspection
    const projectsRef = collection(db, 'projects');
    const q = query(
      projectsRef, 
      where('inspectionContractorId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      
      setProjects(projectsData);
      setIsLoading(false);

      // Fetch homeowner details for any new uids
      const uidsToFetch = Array.from(new Set(projectsData.map(p => p.uid))).filter(uid => !homeownerDetails[uid]);
      
      if (uidsToFetch.length > 0) {
        const newDetails = { ...homeownerDetails };
        await Promise.all(uidsToFetch.map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              newDetails[uid] = { 
                name: userDoc.data().name || 'Unknown Homeowner',
                email: userDoc.data().email || ''
              };
            }
          } catch (err) {
            console.error(`Error fetching user ${uid}:`, err);
          }
        }));
        setHomeownerDetails(newDetails);
      }
    }, (error) => {
      console.error("Error fetching projects for clients:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, homeownerDetails]);

  const filteredProjects = projects.filter(p => {
    const homeowner = homeownerDetails[p.uid];
    const searchString = `${homeowner?.name || ''} ${p.title} ${homeowner?.email || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Clients</h1>
          <p className="text-slate-500 font-medium mt-1">Automatic list of clients from your scheduled inspections.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Active Inspections</p>
            <p className="text-lg font-black text-emerald-700 leading-none">{projects.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-6 justify-between items-center bg-slate-50/30">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search clients, jobs, or emails..." 
              className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
              <Filter size={16} />
              <span>Filter</span>
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-[1.02] transition-all">
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Client Name</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Job</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Inspection</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((p) => {
                const homeowner = homeownerDetails[p.uid];
                return (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={p.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center text-primary font-black text-lg border border-primary/10">
                          {homeowner?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-tight">{homeowner?.name || 'Loading...'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{homeowner?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-800 leading-tight">{p.title}</p>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin size={10} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{p.location?.town || 'Location'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 max-w-xs">
                      <p className="text-xs font-semibold text-slate-500 line-clamp-2 leading-relaxed">
                        {p.description || 'No description provided'}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Calendar size={14} className="opacity-60" />
                        <span className="text-xs font-black tracking-tight">
                          {p.inspectionDate ? new Date(p.inspectionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-[10px] font-black px-4 py-2 rounded-2xl uppercase tracking-[0.1em] inline-block shadow-sm border",
                        p.status === 'In Progress' ? "bg-blue-50 text-blue-600 border-blue-100" : 
                        p.status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                        "bg-primary/5 text-primary border-primary/10"
                      )}>
                        {p.status}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredProjects.length === 0 && (
          <div className="p-32 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-slate-100">
              <Users size={40} className="text-slate-300" />
            </div>
            <h3 className="font-black text-2xl text-slate-900 mb-2">No clients found</h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">
              Your clients list is automatically generated from your scheduled inspections. Schedule an inspection on the Projects page to see clients here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
