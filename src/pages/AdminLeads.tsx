import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Phone, UserRound } from 'lucide-react';
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Lead, LeadInquiry } from '../types';
import { cn } from '../lib/utils';

const LEAD_STATUSES: Lead['status'][] = ['New Lead', 'Contacted', 'Converted', 'Closed'];

function marketplaceStatusForLead(status: Lead['status']) {
  if (status === 'Closed') return 'Closed';
  if (status === 'Contacted' || status === 'Converted') return 'Assigned';
  return 'Open';
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inquiries, setInquiries] = useState<LeadInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leadSnapshot, inquirySnapshot] = await Promise.all([
          getDocs(query(collection(db, 'leads'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'lead_inquiries'), orderBy('createdAt', 'desc'))),
        ]);

        setLeads(
          leadSnapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<Lead, 'id'>),
          }))
        );
        setInquiries(
          inquirySnapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<LeadInquiry, 'id'>),
          }))
        );
      } catch (error) {
        console.error('Error loading leads admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const inquiryMap = useMemo(() => {
    const grouped = new Map<string, LeadInquiry[]>();
    for (const inquiry of inquiries) {
      const current = grouped.get(inquiry.leadId) || [];
      current.push(inquiry);
      grouped.set(inquiry.leadId, current);
    }
    return grouped;
  }, [inquiries]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const updateLeadStatus = async (lead: Lead, status: Lead['status']) => {
    setUpdatingId(lead.id);
    try {
      const updatedAt = new Date().toISOString();
      await Promise.all([
        updateDoc(doc(db, 'leads', lead.id), { status, updatedAt }),
        updateDoc(doc(db, 'lead_marketplace', lead.id), {
          status: marketplaceStatusForLead(status),
          updatedAt,
        }),
      ]);

      setLeads((current) =>
        current.map((entry) => (entry.id === lead.id ? { ...entry, status, updatedAt } : entry))
      );
    } catch (error) {
      console.error('Error updating lead status:', error);
    } finally {
      setUpdatingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Lead Intake</h1>
        <p className="text-sm font-medium text-slate-600">
          Private homeowner leads and contractor introduction requests.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Leads</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{leads.length}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Open Leads</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{leads.filter((lead) => lead.status === 'New Lead').length}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Intro Requests</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{inquiries.length}</p>
        </div>
      </div>

      <div className="space-y-5">
        {leads.map((lead) => {
          const leadInquiries = inquiryMap.get(lead.id) || [];

          return (
            <article key={lead.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{lead.category}</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{lead.location?.street || 'Lead Request'}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {[lead.location?.town, lead.location?.zip].filter(Boolean).join(' ')}
                    </p>
                  </div>
                  <p className="max-w-3xl text-sm font-medium leading-6 text-slate-600">{lead.description}</p>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[220px]">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lead Status</span>
                    <select
                      value={lead.status}
                      onChange={(event) => void updateLeadStatus(lead, event.target.value as Lead['status'])}
                      disabled={updatingId === lead.id}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-primary"
                    >
                      {LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs font-medium text-slate-500">{formatDate(lead.createdAt)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Homeowner Contact</p>
                  <div className="mt-3 space-y-2 text-sm font-medium text-slate-700">
                    <p className="inline-flex items-center gap-2"><UserRound size={14} /> {lead.name}</p>
                    <p className="inline-flex items-center gap-2"><Phone size={14} /> {lead.phone}</p>
                    <p className="inline-flex items-center gap-2"><Mail size={14} /> {lead.email}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Contractor Requests</p>
                  <div className="mt-3 space-y-3">
                    {leadInquiries.length === 0 ? (
                      <p className="text-sm font-medium text-slate-500">No contractor requests yet.</p>
                    ) : (
                      leadInquiries.map((inquiry) => (
                        <div key={inquiry.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-slate-900">{inquiry.contractorName}</p>
                              <p className="text-xs font-medium text-slate-500">{inquiry.contractorEmail}</p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                                inquiry.status === 'Requested' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {inquiry.status}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{inquiry.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {lead.photos?.length ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  {lead.photos.map((photo, index) => (
                    <img
                      key={`${lead.id}-photo-${index}`}
                      src={photo}
                      alt={`${lead.category} photo ${index + 1}`}
                      className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
