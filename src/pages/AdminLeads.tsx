import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Phone, UserRound, X } from 'lucide-react';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Lead, LeadInquiry, LeadActivity } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

const LEAD_STATUSES: Lead['status'][] = ['New Lead', 'Contacted', 'Converted', 'Closed'];

function marketplaceStatusForLead(status: Lead['status']) {
  if (status === 'Closed') return 'Closed';
  if (status === 'Contacted' || status === 'Converted') return 'Assigned';
  return 'Open';
}

function leadStatusClass(status: Lead['status']) {
  if (status === 'New Lead') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Contacted') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'Converted') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export default function AdminLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inquiries, setInquiries] = useState<LeadInquiry[]>([]);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [contactModal, setContactModal] = useState<{
    leadId: string;
    inquiryId?: string;
    email: string;
    name: string;
    recipientType: 'homeowner' | 'home-pro';
    phone?: string;
    subject: string;
    message: string;
  } | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [contactError, setContactError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leadSnapshot, inquirySnapshot, activitySnapshot] = await Promise.all([
          getDocs(query(collection(db, 'leads'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'lead_inquiries'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'lead_activity'), orderBy('createdAt', 'desc'))).catch((error) => {
            console.warn('Lead activity unavailable, continuing without history:', error);
            return { docs: [] } as Awaited<ReturnType<typeof getDocs>>;
          }),
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
        setActivity(
          activitySnapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<LeadActivity, 'id'>),
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

  const activityMap = useMemo(() => {
    const grouped = new Map<string, LeadActivity[]>();
    for (const entry of activity) {
      const current = grouped.get(entry.leadId) || [];
      current.push(entry);
      grouped.set(entry.leadId, current);
    }
    return grouped;
  }, [activity]);

  const sanitizePhoneLink = (value: string | undefined) => `tel:${(value || '').replace(/[^\d+]/g, '')}`;

  const openContactModal = ({
    email,
    name,
    recipientType,
    leadId,
    inquiryId,
    phone,
    subject,
    message,
  }: {
    leadId: string;
    inquiryId?: string;
    email: string;
    name: string;
    recipientType: 'homeowner' | 'home-pro';
    phone?: string;
    subject: string;
    message: string;
  }) => {
    setContactError('');
    setContactModal({ leadId, inquiryId, email, name, recipientType, phone, subject, message });
  };

  const sendAdminMessage = async () => {
    if (!contactModal) return;

    setIsSendingMessage(true);
    setContactError('');
    try {
      const response = await fetch('/api/send-admin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactModal),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to send message');
      }

      const activityEntry = {
        leadId: contactModal.leadId,
        inquiryId: contactModal.inquiryId,
        eventType: 'admin_message_sent' as const,
        recipientType: contactModal.recipientType,
        message: `Admin sent a Blueprint message to ${contactModal.name}: ${contactModal.subject}`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt: new Date().toISOString(),
      };

      const activityRef = await addDoc(collection(db, 'lead_activity'), activityEntry);
      setActivity((current) => [{ id: activityRef.id, ...activityEntry }, ...current]);

      setContactModal(null);
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
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
      const activityEntry = {
        leadId: lead.id,
        eventType: 'status_changed' as const,
        message: `Lead status changed to ${status}`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt: updatedAt,
      };
      const activityRef = await addDoc(collection(db, 'lead_activity'), activityEntry);
      setActivity((current) => [{ id: activityRef.id, ...activityEntry }, ...current]);
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

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total Leads</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{leads.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Open Leads</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{leads.filter((lead) => lead.status === 'New Lead').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Intro Requests</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{inquiries.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1200px] border-collapse text-left">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Created</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Category</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Client Type</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Location</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Description</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Photos</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Intro Requests</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Latest Activity</th>
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const leadInquiries = inquiryMap.get(lead.id) || [];
              const leadActivity = activityMap.get(lead.id) || [];
              const latestActivity = leadActivity[0];

              return (
                <tr key={lead.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <span className={cn('inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]', leadStatusClass(lead.status))}>
                        {lead.status}
                      </span>
                      <select
                        value={lead.status}
                        onChange={(event) => void updateLeadStatus(lead, event.target.value as Lead['status'])}
                        disabled={updatingId === lead.id}
                        className="h-8 w-[132px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none transition-colors focus:border-primary"
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-slate-600">{formatDate(lead.createdAt)}</td>
                  <td className="px-3 py-3 text-xs font-bold text-slate-900">{lead.category}</td>
                  <td className="px-3 py-3">
                    <div className="space-y-1 text-xs">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Owner</p>
                      <p className="font-black text-slate-900">{lead.name}</p>
                      <p className="text-slate-600">{lead.phone}</p>
                      <p className="text-slate-600">{lead.email}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-slate-600">
                    <p>{lead.location?.street || 'No street'}</p>
                    <p>{[lead.location?.town, lead.location?.zip].filter(Boolean).join(' ') || 'No location'}</p>
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-xs font-medium leading-5 text-slate-600">
                    <p className="line-clamp-4">{lead.description}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-bold text-slate-700">
                    {lead.photoCount ? `${lead.photoCount} attached` : '0'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-2 text-xs">
                      {leadInquiries.length === 0 ? (
                        <p className="font-medium text-slate-500">None</p>
                      ) : (
                        leadInquiries.map((inquiry) => (
                          <div key={inquiry.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Pro</p>
                                <p className="font-black text-slate-900">{inquiry.contractorName}</p>
                              </div>
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                                {inquiry.status}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600">{inquiry.contractorEmail}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-slate-600">
                    {latestActivity ? (
                      <div className="space-y-1">
                        <p className="line-clamp-3">{latestActivity.message}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          {(latestActivity.actorName || 'Admin')} • {formatDate(latestActivity.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500">No history yet</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <a
                        href={sanitizePhoneLink(lead.phone)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 hover:border-primary hover:text-primary"
                      >
                        <Phone size={11} />
                        Call
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          openContactModal({
                            leadId: lead.id,
                            email: lead.email,
                            name: lead.name,
                            recipientType: 'homeowner',
                            phone: lead.phone,
                            subject: `Blueprint update for your ${lead.category} request`,
                            message: `Hi ${lead.name},\n\nThis is Blueprint Home Solutions following up on your ${lead.category} request in ${lead.location?.town || 'your area'}.\n\nWe are reviewing your request and will update you shortly.\n\nBest regards,\nBlueprint Home Solutions`,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 hover:border-primary hover:text-primary"
                      >
                        <Mail size={11} />
                        Email
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Blueprint Thread</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {contactModal.recipientType === 'home-pro' ? 'Home Pro Communication' : 'Homeowner Communication'}
                </h3>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Sending to {contactModal.name} at {contactModal.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactModal(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subject</span>
                <input
                  value={contactModal.subject}
                  onChange={(event) =>
                    setContactModal((current) => (current ? { ...current, subject: event.target.value } : current))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Message</span>
                <textarea
                  value={contactModal.message}
                  onChange={(event) =>
                    setContactModal((current) => (current ? { ...current, message: event.target.value } : current))
                  }
                  className="min-h-[220px] w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
                />
              </label>

              {contactError && <p className="text-sm font-bold text-red-600">{contactError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <a
                href={sanitizePhoneLink(contactModal.phone)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700',
                  contactModal.phone ? 'bg-white hover:border-primary hover:text-primary' : 'pointer-events-none opacity-40'
                )}
              >
                <Phone size={14} />
                Call
              </a>
              <button
                type="button"
                onClick={sendAdminMessage}
                disabled={isSendingMessage || !contactModal.subject.trim() || !contactModal.message.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSendingMessage ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
