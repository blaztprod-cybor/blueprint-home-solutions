import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Calendar, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  Building2,
  Hammer,
  ArrowRight,
  Star,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Project } from '../types';

export default function HomeownerDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'projects'),
      where('uid', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const activeProjects = projects.filter(p => p.status === 'In Progress' || p.status === 'Planning');
  const completedProjects = projects.filter(p => p.status === 'Completed');

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-4">
        <h1 className="text-3xl font-black tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground mt-1 font-medium">Manage your home improvement journey</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Projects', value: activeProjects.length.toString(), icon: Clock, color: 'text-blue-600 bg-blue-50' },
          { label: 'Pending Quotes', value: '0', icon: MessageSquare, color: 'text-amber-600 bg-amber-50' },
          { label: 'Completed', value: completedProjects.length.toString(), icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", stat.color)}>
              <stat.icon size={20} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-1 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-lg">Active Projects</h3>
            <Link to="/projects" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {activeProjects.length > 0 ? (
              activeProjects.map((project, i) => (
                <div key={i} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{project.title}</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                      {project.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Progress</span>
                      <span>{project.status === 'Planning' ? '10' : '65'}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${project.status === 'Planning' ? '10' : '65'}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <Hammer size={24} />
                </div>
                <h4 className="font-bold text-slate-900">No active projects</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Start your home improvement journey by creating a new project.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
