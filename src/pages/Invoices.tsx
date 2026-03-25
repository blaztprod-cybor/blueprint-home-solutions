import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Search, 
  Download, 
  MoreVertical, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { MOCK_INVOICES } from '../mockData';
import { cn } from '../lib/utils';

export default function Invoices() {
  const [invoices] = useState(MOCK_INVOICES);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Invoices are automatically generated for tracking. Payments are made directly from the client to you.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Outstanding</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold">$0.00</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">0 Overdue</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Paid This Month</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold">$0.00</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">0% vs last month</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Pending Approval</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold">$0.00</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">0 Invoices</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by invoice ID or project..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          {invoices.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-sm font-bold">{invoice.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">Project #{invoice.projectId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold">${invoice.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-500 font-medium">{invoice.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 w-fit",
                        invoice.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : 
                        invoice.status === 'Overdue' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {invoice.status === 'Paid' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-all">
                          <ArrowUpRight size={16} />
                        </button>
                        <button className="p-2 text-slate-400 hover:bg-white rounded-lg transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No invoices found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">Your generated invoices will appear here once you start billing for projects.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
