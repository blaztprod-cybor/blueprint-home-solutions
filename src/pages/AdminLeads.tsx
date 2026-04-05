import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Phone, X } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Lead,
  LeadActivity,
  LeadInquiry,
  LeadInquiryHistory,
  LeadInquiryNote,
} from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

const LEAD_STATUSES: Lead['status'][] = ['New Lead', 'Contacted', 'Converted', 'Closed'];
const INQUIRY_STATUSES: LeadInquiry['status'][] = [
  'Requested',
  'Admin Reviewing',
  'Homeowner Contact Pending',
  'Homeowner Confirmed',
  'Introduction Approved',
  'Declined',
  'Closed',
];
const ACTIVE_INQUIRY_STATUSES: LeadInquiry['status'][] = [
  'Requested',
  'Admin Reviewing',
  'Homeowner Contact Pending',
  'Homeowner Confirmed',
];

function marketplaceStatusForLead(status: Lead['status']) {
  if (status === 'Closed') return 'Closed';
  if (status === 'Contacted' || status === 'Converted') return 'Assigned';
  return 'Open';
}

function inquiryStatusClass(status: LeadInquiry['status']) {
  if (status === 'Requested') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'Admin Reviewing') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'Homeowner Contact Pending') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (status === 'Homeowner Confirmed') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (status === 'Introduction Approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Declined') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-200 text-slate-700 border-slate-300';
}

function leadStatusClass(status: Lead['status']) {
  if (status === 'New Lead') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Contacted') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'Converted') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function historyEventTypeLabel(eventType: LeadInquiryHistory['eventType']) {
  if (eventType === 'request_created') return 'Request Created';
  if (eventType === 'status_changed') return 'Status Changed';
  if (eventType === 'note_added') return 'Note Added';
  if (eventType === 'homeowner_email_sent') return 'Homeowner Email';
  if (eventType === 'home_pro_email_sent') return 'Home Pro Email';
  if (eventType === 'introduction_approved') return 'Introduction Approved';
  return 'Request Declined';
}

type ContactModalState = {
  leadId: string;
  inquiryId?: string;
  email: string;
  name: string;
  recipientType: 'homeowner' | 'home-pro';
  phone?: string;
  subject: string;
  message: string;
} | null;

export default function AdminLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inquiries, setInquiries] = useState<LeadInquiry[]>([]);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadInquiryNote[]>([]);
  const [inquiryHistory, setInquiryHistory] = useState<LeadInquiryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [contactModal, setContactModal] = useState<ContactModalState>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [contactError, setContactError] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [declineReasons, setDeclineReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leadSnapshot, inquirySnapshot, activitySnapshot, noteSnapshot, historySnapshot] = await Promise.all([
          getDocs(query(collection(db, 'leads'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'lead_inquiries'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'lead_activity'), orderBy('createdAt', 'desc'))).catch(() => {
            return { docs: [] } as Awaited<ReturnType<typeof getDocs>>;
          }),
          getDocs(query(collection(db, 'lead_inquiry_notes'), orderBy('createdAt', 'desc'))).catch(() => {
            return { docs: [] } as Awaited<ReturnType<typeof getDocs>>;
          }),
          getDocs(query(collection(db, 'lead_inquiry_history'), orderBy('createdAt', 'desc'))).catch(() => {
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
        setNotes(
          noteSnapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<LeadInquiryNote, 'id'>),
          }))
        );
        setInquiryHistory(
          historySnapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<LeadInquiryHistory, 'id'>),
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
      current.sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt).getTime();
        return rightTime - leftTime;
      });
      grouped.set(inquiry.leadId, current);
    }
    return grouped;
  }, [inquiries]);

  const activityMap = useMemo(() => {
    const grouped = new Map<string, LeadActivity[]>();
    for (const entry of activity) {
      const current = grouped.get(entry.leadId) || [];
      current.push(entry);
      grouped.set(entry.leadId, current);
    }
    return grouped;
  }, [activity]);

  const notesMap = useMemo(() => {
    const grouped = new Map<string, LeadInquiryNote[]>();
    for (const entry of notes) {
      const current = grouped.get(entry.inquiryId) || [];
      current.push(entry);
      current.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      grouped.set(entry.inquiryId, current);
    }
    return grouped;
  }, [notes]);

  const inquiryHistoryMap = useMemo(() => {
    const grouped = new Map<string, LeadInquiryHistory[]>();
    for (const entry of inquiryHistory) {
      const current = grouped.get(entry.inquiryId) || [];
      current.push(entry);
      current.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      grouped.set(entry.inquiryId, current);
    }
    return grouped;
  }, [inquiryHistory]);

  const formatDate = (value: string | undefined) => {
    if (!value) return 'Not yet';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const sanitizePhoneLink = (value: string | undefined) => `tel:${(value || '').replace(/[^\d+]/g, '')}`;

  const appendLeadActivity = async (entry: Omit<LeadActivity, 'id'>) => {
    const activityRef = await addDoc(collection(db, 'lead_activity'), entry);
    setActivity((current) => [{ id: activityRef.id, ...entry }, ...current]);
  };

  const appendInquiryHistory = async (entry: Omit<LeadInquiryHistory, 'id'>) => {
    const historyRef = await addDoc(collection(db, 'lead_inquiry_history'), entry);
    setInquiryHistory((current) => [{ id: historyRef.id, ...entry }, ...current]);
  };

  const syncMarketplaceStatus = async (lead: Lead, nextInquiries: LeadInquiry[]) => {
    const nextStatus = nextInquiries.some((entry) => entry.status === 'Introduction Approved')
      ? 'Assigned'
      : nextInquiries.some((entry) => ACTIVE_INQUIRY_STATUSES.includes(entry.status))
        ? 'Requested'
        : lead.status === 'Closed'
          ? 'Closed'
          : 'Open';

    await updateDoc(doc(db, 'lead_marketplace', lead.id), {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const openContactModal = ({
    email,
    name,
    recipientType,
    leadId,
    inquiryId,
    phone,
    subject,
    message,
  }: NonNullable<ContactModalState>) => {
    setContactError('');
    setContactModal({ leadId, inquiryId, email, name, recipientType, phone, subject, message });
  };

  const sendIntroEmail = async (path: string, payload: Record<string, unknown>) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Failed request to ${path}`);
    }

    return response.json().catch(() => ({}));
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
      await appendLeadActivity({
        leadId: lead.id,
        eventType: 'status_changed',
        message: `Lead status changed to ${status}`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt: updatedAt,
      });
    } catch (error) {
      console.error('Error updating lead status:', error);
    } finally {
      setUpdatingId('');
    }
  };

  const updateInquiryStatus = async (
    lead: Lead,
    inquiry: LeadInquiry,
    status: LeadInquiry['status']
  ) => {
    setUpdatingId(inquiry.id);
    try {
      const updatedAt = new Date().toISOString();
      const patch: Partial<LeadInquiry> & { status: LeadInquiry['status']; updatedAt: string; statusUpdatedAt: string } = {
        status,
        updatedAt,
        statusUpdatedAt: updatedAt,
      };

      if (status !== 'Requested') {
        patch.reviewedBy = {
          id: user?.id,
          name: user?.name || 'Admin',
        };
      }

      if (status === 'Homeowner Contact Pending') {
        patch.homeownerContactedAt = updatedAt;
      }

      if (status === 'Homeowner Confirmed') {
        patch.homeownerConfirmedAt = updatedAt;
      }

      if (status === 'Declined') {
        const declineReason = (declineReasons[inquiry.id] || '').trim();
        patch.declinedAt = updatedAt;
        patch.declineReason = declineReason || inquiry.declineReason;
      }

      if (status === 'Admin Reviewing') {
        const emailResult = await sendIntroEmail('/api/send-intro-review-update', {
          recipientType: 'home-pro',
          recipientEmail: inquiry.contractorEmail,
          recipientName: inquiry.contractorName,
          category: lead.category,
          location: lead.location?.town,
          statusLabel: status,
          nextStep: 'Blueprint is reviewing fit and homeowner readiness before any introduction is approved.',
        });
        patch.lastCommunicationAt = updatedAt;
        await appendInquiryHistory({
          inquiryId: inquiry.id,
          eventType: 'home_pro_email_sent',
          message: `Blueprint sent a review update to ${inquiry.contractorEmail}.`,
          actorId: user?.id,
          actorName: user?.name || 'Admin',
          metadata: emailResult?.threadId ? { threadId: String(emailResult.threadId) } : undefined,
          createdAt: updatedAt,
        });
      }

      if (status === 'Homeowner Contact Pending') {
        const emailResult = await sendIntroEmail('/api/send-intro-review-update', {
          recipientType: 'homeowner',
          recipientEmail: lead.email,
          recipientName: lead.name,
          category: lead.category,
          location: lead.location?.town,
          statusLabel: 'Vendor interest under review',
          nextStep: `Blueprint is reviewing a request from ${inquiry.contractorName} and will confirm before making any introduction.`,
        });
        patch.lastCommunicationAt = updatedAt;
        await appendInquiryHistory({
          inquiryId: inquiry.id,
          eventType: 'homeowner_email_sent',
          message: `Blueprint sent a vendor-interest update to ${lead.email}.`,
          actorId: user?.id,
          actorName: user?.name || 'Admin',
          metadata: emailResult?.threadId ? { threadId: String(emailResult.threadId) } : undefined,
          createdAt: updatedAt,
        });
      }

      if (status === 'Introduction Approved') {
        const emailResult = await sendIntroEmail('/api/send-intro-approval-shared-thread', {
          homeownerEmail: lead.email,
          homeownerName: lead.name,
          contractorEmail: inquiry.contractorEmail,
          contractorName: inquiry.contractorName,
          category: lead.category,
          location: lead.location?.town,
          homeownerPhone: lead.phone,
        });
        patch.approvedAt = updatedAt;
        patch.lastCommunicationAt = updatedAt;
        patch.introductionThreadId =
          emailResult?.threadId || emailResult?.messageId || `intro-${inquiry.id}-${Date.now()}`;
        await appendInquiryHistory({
          inquiryId: inquiry.id,
          eventType: 'introduction_approved',
          message: `Blueprint approved the introduction and sent the shared introduction email.`,
          actorId: user?.id,
          actorName: user?.name || 'Admin',
          metadata: patch.introductionThreadId ? { threadId: String(patch.introductionThreadId) } : undefined,
          createdAt: updatedAt,
        });
      }

      if (status === 'Declined') {
        const emailResult = await sendIntroEmail('/api/send-intro-decline', {
          contractorEmail: inquiry.contractorEmail,
          contractorName: inquiry.contractorName,
          category: lead.category,
          location: lead.location?.town,
          declineReason: patch.declineReason,
        });
        patch.lastCommunicationAt = updatedAt;
        await appendInquiryHistory({
          inquiryId: inquiry.id,
          eventType: 'request_declined',
          message: `Blueprint declined the request${patch.declineReason ? `: ${patch.declineReason}` : '.'}`,
          actorId: user?.id,
          actorName: user?.name || 'Admin',
          metadata: emailResult?.threadId ? { threadId: String(emailResult.threadId) } : undefined,
          createdAt: updatedAt,
        });
      }

      await updateDoc(doc(db, 'lead_inquiries', inquiry.id), patch);

      const nextInquiry = { ...inquiry, ...patch };
      const nextInquiries = inquiries.map((entry) => (entry.id === inquiry.id ? nextInquiry : entry));
      setInquiries(nextInquiries);
      await syncMarketplaceStatus(lead, nextInquiries.filter((entry) => entry.leadId === lead.id));

      await appendInquiryHistory({
        inquiryId: inquiry.id,
        eventType: 'status_changed',
        message: `Request status changed to ${status}.`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        metadata: inquiry.status !== status ? { from: inquiry.status, to: status } : undefined,
        createdAt: updatedAt,
      });

      await appendLeadActivity({
        leadId: lead.id,
        inquiryId: inquiry.id,
        eventType: 'status_changed',
        message: `${inquiry.contractorName} request moved to ${status}.`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt: updatedAt,
      });
    } catch (error) {
      console.error('Error updating inquiry status:', error);
    } finally {
      setUpdatingId('');
    }
  };

  const addInquiryNote = async (lead: Lead, inquiry: LeadInquiry) => {
    const body = (noteDrafts[inquiry.id] || '').trim();
    if (!body) return;

    setUpdatingId(inquiry.id);
    try {
      const createdAt = new Date().toISOString();
      const noteEntry: Omit<LeadInquiryNote, 'id'> = {
        inquiryId: inquiry.id,
        body,
        authorId: user?.id,
        authorName: user?.name || 'Admin',
        createdAt,
      };
      const noteRef = await addDoc(collection(db, 'lead_inquiry_notes'), noteEntry);
      setNotes((current) => [{ id: noteRef.id, ...noteEntry }, ...current]);
      setNoteDrafts((current) => ({ ...current, [inquiry.id]: '' }));

      await appendInquiryHistory({
        inquiryId: inquiry.id,
        eventType: 'note_added',
        message: `Internal note added: ${body}`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt,
      });

      await appendLeadActivity({
        leadId: lead.id,
        inquiryId: inquiry.id,
        eventType: 'admin_message_sent',
        message: `Internal note added for ${inquiry.contractorName}.`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt,
      });
    } catch (error) {
      console.error('Error adding inquiry note:', error);
    } finally {
      setUpdatingId('');
    }
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

      const createdAt = new Date().toISOString();
      await appendLeadActivity({
        leadId: contactModal.leadId,
        inquiryId: contactModal.inquiryId,
        eventType: 'admin_message_sent',
        recipientType: contactModal.recipientType,
        message: `Admin sent a Blueprint message to ${contactModal.name}: ${contactModal.subject}`,
        actorId: user?.id,
        actorName: user?.name || 'Admin',
        createdAt,
      });

      if (contactModal.inquiryId) {
        await appendInquiryHistory({
          inquiryId: contactModal.inquiryId,
          eventType: contactModal.recipientType === 'home-pro' ? 'home_pro_email_sent' : 'homeowner_email_sent',
          message: `Admin sent ${contactModal.recipientType === 'home-pro' ? 'a Home Pro' : 'a homeowner'} message: ${contactModal.subject}`,
          actorId: user?.id,
          actorName: user?.name || 'Admin',
          createdAt,
        });

        await updateDoc(doc(db, 'lead_inquiries', contactModal.inquiryId), {
          updatedAt: createdAt,
          lastCommunicationAt: createdAt,
        });
        setInquiries((current) =>
          current.map((entry) =>
            entry.id === contactModal.inquiryId ? { ...entry, updatedAt: createdAt, lastCommunicationAt: createdAt } : entry
          )
        );
      }

      setContactModal(null);
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
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
          <p className="mt-1 text-2xl font-black text-slate-900">
            {leads.filter((lead) => lead.status === 'New Lead').length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Intro Requests</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{inquiries.length}</p>
        </div>
      </div>

      <div className="space-y-5">
        {leads.map((lead) => {
          const leadInquiries = inquiryMap.get(lead.id) || [];
          const leadActivity = activityMap.get(lead.id) || [];
          const latestActivity = leadActivity[0];

          return (
            <section key={lead.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Lead</p>
                      <h2 className="text-2xl font-black tracking-tight text-slate-900">{lead.category}</h2>
                      <p className="text-sm font-medium text-slate-600">
                        {lead.name} • {lead.email} • {lead.phone}
                      </p>
                      <p className="text-sm font-medium text-slate-500">
                        {[lead.location?.street, lead.location?.town, lead.location?.zip].filter(Boolean).join(', ') || 'No location'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]',
                          leadStatusClass(lead.status)
                        )}
                      >
                        {lead.status}
                      </span>
                      <select
                        value={lead.status}
                        onChange={(event) => void updateLeadStatus(lead, event.target.value as Lead['status'])}
                        disabled={updatingId === lead.id}
                        className="h-9 w-[152px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none transition-colors focus:border-primary"
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Created</p>
                      <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(lead.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Photos</p>
                      <p className="mt-1 text-sm font-bold text-slate-700">{lead.photoCount || 0} attached</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Intro Requests</p>
                      <p className="mt-1 text-sm font-bold text-slate-700">{leadInquiries.length}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Description</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{lead.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={sanitizePhoneLink(lead.phone)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 hover:border-primary hover:text-primary"
                    >
                      <Phone size={14} />
                      Call Homeowner
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
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 hover:border-primary hover:text-primary"
                    >
                      <Mail size={14} />
                      Email Homeowner
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Lead Activity</p>
                    {latestActivity ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-slate-700">{latestActivity.message}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          {(latestActivity.actorName || 'Admin')} • {formatDate(latestActivity.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No lead-level history yet.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black text-slate-900">Introduction Requests</h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {leadInquiries.length} requests
                    </span>
                  </div>

                  {leadInquiries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      No contractor requests for this lead yet.
                    </div>
                  ) : (
                    leadInquiries.map((inquiry) => {
                      const inquiryNotes = notesMap.get(inquiry.id) || [];
                      const historyEntries = inquiryHistoryMap.get(inquiry.id) || [];

                      return (
                        <article key={inquiry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Home Pro</p>
                              <p className="text-base font-black text-slate-900">{inquiry.contractorName}</p>
                              <p className="text-sm text-slate-600">{inquiry.contractorEmail}</p>
                            </div>
                            <span
                              className={cn(
                                'rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]',
                                inquiryStatusClass(inquiry.status)
                              )}
                            >
                              {inquiry.status}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-600">{inquiry.message}</p>

                          <div className="mt-3 grid gap-2 text-[11px] font-medium text-slate-500 md:grid-cols-2">
                            <p>Requested: {formatDate(inquiry.createdAt)}</p>
                            <p>Status Updated: {formatDate(inquiry.statusUpdatedAt || inquiry.updatedAt || inquiry.createdAt)}</p>
                            <p>Homeowner Contacted: {formatDate(inquiry.homeownerContactedAt)}</p>
                            <p>Homeowner Confirmed: {formatDate(inquiry.homeownerConfirmedAt)}</p>
                            <p>Approved: {formatDate(inquiry.approvedAt)}</p>
                            <p>Declined: {formatDate(inquiry.declinedAt)}</p>
                            {inquiry.introductionThreadId && <p>Thread: {inquiry.introductionThreadId}</p>}
                            {inquiry.reviewedBy?.name && <p>Reviewed By: {inquiry.reviewedBy.name}</p>}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id || inquiry.status === 'Admin Reviewing'}
                              onClick={() => void updateInquiryStatus(lead, inquiry, 'Admin Reviewing')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-50"
                            >
                              Start Review
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id || inquiry.status === 'Homeowner Contact Pending'}
                              onClick={() => void updateInquiryStatus(lead, inquiry, 'Homeowner Contact Pending')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-50"
                            >
                              Mark Homeowner Contacted
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id || inquiry.status === 'Homeowner Confirmed'}
                              onClick={() => void updateInquiryStatus(lead, inquiry, 'Homeowner Confirmed')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-50"
                            >
                              Mark Homeowner Confirmed
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id || inquiry.status === 'Introduction Approved'}
                              onClick={() => void updateInquiryStatus(lead, inquiry, 'Introduction Approved')}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
                            >
                              Approve Introduction
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id}
                              onClick={() => void updateInquiryStatus(lead, inquiry, 'Declined')}
                              className="rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id || inquiry.status === 'Closed'}
                              onClick={() => void updateInquiryStatus(lead, inquiry, 'Closed')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 disabled:opacity-50"
                            >
                              Close
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Decline Reason</span>
                              <input
                                value={declineReasons[inquiry.id] ?? inquiry.declineReason ?? ''}
                                onChange={(event) =>
                                  setDeclineReasons((current) => ({
                                    ...current,
                                    [inquiry.id]: event.target.value,
                                  }))
                                }
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary"
                                placeholder="Optional decline reason"
                              />
                            </label>
                            <div className="flex flex-wrap items-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openContactModal({
                                    leadId: lead.id,
                                    inquiryId: inquiry.id,
                                    email: inquiry.contractorEmail,
                                    name: inquiry.contractorName,
                                    recipientType: 'home-pro',
                                    subject: `Blueprint update for your ${lead.category} introduction request`,
                                    message: `Hi ${inquiry.contractorName},\n\nBlueprint is following up on your introduction request for ${lead.category} in ${lead.location?.town || 'this area'}.\n\nWe will keep you updated as the request moves through review.\n\nBest regards,\nBlueprint Home Solutions`,
                                  })
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700"
                              >
                                <Mail size={14} />
                                Email Pro
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openContactModal({
                                    leadId: lead.id,
                                    inquiryId: inquiry.id,
                                    email: lead.email,
                                    name: lead.name,
                                    recipientType: 'homeowner',
                                    phone: lead.phone,
                                    subject: `Blueprint is reviewing contractor interest in your ${lead.category} request`,
                                    message: `Hi ${lead.name},\n\nBlueprint is reviewing contractor interest in your ${lead.category} request in ${lead.location?.town || 'your area'}.\n\nWe will confirm with you before releasing any direct introduction.\n\nBest regards,\nBlueprint Home Solutions`,
                                  })
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700"
                              >
                                <Mail size={14} />
                                Email Homeowner
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Internal Notes</p>
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                                {inquiryNotes.length} notes
                              </span>
                            </div>
                            <textarea
                              value={noteDrafts[inquiry.id] || ''}
                              onChange={(event) =>
                                setNoteDrafts((current) => ({
                                  ...current,
                                  [inquiry.id]: event.target.value,
                                }))
                              }
                              className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary"
                              placeholder="Add internal note..."
                            />
                            <button
                              type="button"
                              disabled={updatingId === inquiry.id || !(noteDrafts[inquiry.id] || '').trim()}
                              onClick={() => void addInquiryNote(lead, inquiry)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
                            >
                              Add Note
                            </button>
                            {inquiryNotes.length > 0 ? (
                              <div className="space-y-2">
                                {inquiryNotes.slice(0, 3).map((note) => (
                                  <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-sm text-slate-700">{note.body}</p>
                                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                                      {note.authorName || 'Admin'} • {formatDate(note.createdAt)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No inquiry notes yet.</p>
                            )}
                          </div>

                          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Request History</p>
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                                {historyEntries.length} events
                              </span>
                            </div>
                            {historyEntries.length > 0 ? (
                              <div className="space-y-2">
                                {historyEntries.slice(0, 5).map((entry) => (
                                  <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                                      {historyEventTypeLabel(entry.eventType)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">{entry.message}</p>
                                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                                      {entry.actorName || 'Blueprint'} • {formatDate(entry.createdAt)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No inquiry history yet.</p>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          );
        })}
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
