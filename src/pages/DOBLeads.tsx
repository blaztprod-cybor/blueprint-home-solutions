import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  User, 
  Building2, 
  ExternalLink, 
  Lock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { fetchDOBPermits } from '../services/dobService';
import { DOBPermit } from '../types';
import { cn } from '../lib/utils';

export default function DOBLeads() {
  const [permits, setPermits] = useState<DOBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchDOBPermits(10);
      setPermits(data);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Recent Permits</h1>
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Live Feed</span>
          </div>
          <p className="text-muted-foreground">Real-time construction permits issued by the NYC Department of Buildings.</p>
        </div>
        {!isSubscribed && (
          <button 
            onClick={() => setIsSubscribed(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
          >
            <Zap size={20} fill="currentColor" />
            <span>Upgrade for Full Access</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">House No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Street Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Borough</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applicant Business Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-primary mb-4" size={40} />
                      <p className="font-bold text-slate-500">Processing NYC DOB Data...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                permits.map((permit, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={permit.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className={cn("text-sm font-bold", !isSubscribed && "blur-[4px] select-none")}>
                        {isSubscribed ? permit.house_number : "123"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("text-sm font-medium text-slate-600", !isSubscribed && "blur-[4px] select-none")}>
                        {isSubscribed ? permit.street_name : "Hidden Street"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700">{permit.borough}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-widest">
                        {permit.job_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("text-sm font-medium text-slate-600", !isSubscribed && "blur-[4px] select-none")}>
                        {isSubscribed ? permit.owner_business_name : "•••• •••••"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 line-clamp-1 italic max-w-xs">
                        "{permit.job_description}"
                      </p>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
