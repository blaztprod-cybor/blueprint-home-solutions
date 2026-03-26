import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Loader2
} from 'lucide-react';
import { fetchDOBPermits } from '../services/dobService';
import { DOBPermit } from '../types';
import { cn } from '../lib/utils';

export default function DOBLeads() {
  const [permits, setPermits] = useState<DOBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [boroughFilter, setBoroughFilter] = useState('All Boroughs');
  const [workTypeFilter, setWorkTypeFilter] = useState('All Work Types');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchDOBPermits(50);
      setPermits(data);
      setLoading(false);
    };
    loadData();
  }, []);

  const boroughOptions = ['All Boroughs', ...Array.from(new Set(
    permits
      .map((permit) => permit.borough)
      .filter(Boolean)
  )).sort()];

  const workTypeOptions = ['All Work Types', ...Array.from(new Set(
    permits
      .map((permit) => permit.job_type)
      .filter(Boolean)
  )).sort()];

  const filteredPermits = permits.filter((permit) => {
    const matchesBorough = boroughFilter === 'All Boroughs' || permit.borough === boroughFilter;
    const matchesWorkType = workTypeFilter === 'All Work Types' || permit.job_type === workTypeFilter;
    return matchesBorough && matchesWorkType;
  });

  const formatPermitDate = (value: string) => {
    if (!value) return 'N/A';

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 20000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const converted = new Date(excelEpoch.getTime() + numericValue * 86400000);
      return Number.isNaN(converted.getTime()) ? value : converted.toLocaleDateString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Permit Feed</h1>
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Live Feed</span>
          </div>
          <p className="text-muted-foreground">Real-time construction permits issued by the NYC Department of Buildings.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Map Setup</p>
          <p className="mt-1 text-xs font-bold text-slate-600">Use NYC Geoclient to geocode permit addresses for a map view.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filter By Borough</span>
          <select
            value={boroughFilter}
            onChange={(event) => setBoroughFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary"
          >
            {boroughOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filter By Work Type</span>
          <select
            value={workTypeFilter}
            onChange={(event) => setWorkTypeFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary"
          >
            {workTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-scroll pb-3">
          <table className="w-full text-left border-collapse min-w-[1800px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Borough</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Street</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Issued</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Description</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-primary mb-4" size={40} />
                      <p className="font-bold text-slate-500">Processing NYC DOB Data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPermits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-bold text-slate-700">No permits match these filters</p>
                      <p className="mt-2 text-sm text-slate-500">Try a different borough or work type.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPermits.map((permit, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={permit.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700">{permit.borough}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                        {[permit.house_number, permit.street_name].filter(Boolean).join(' ') || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600">{permit.street_name || 'Unavailable'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-700 rounded-lg uppercase tracking-widest">
                        {permit.job_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg uppercase tracking-widest whitespace-nowrap">
                        {formatPermitDate(permit.issuance_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 italic max-w-md min-w-[260px]">
                        "{permit.job_description}"
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                        permit.permit_status === 'ISSUED' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
                      )}>
                        {permit.permit_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                        {permit.owner_business_name || permit.owner_name || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">
                        {permit.phone_number || 'Phone not connected yet'}
                      </span>
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
