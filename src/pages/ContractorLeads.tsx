import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeadInquiry, LeadMarketplaceItem } from '../types';
import { cn } from '../lib/utils';

export default function ContractorLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadMarketplaceItem[]>([]);
  const [inquiries, setInquiries] = useState<LeadInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [selectedLead, setSelectedLead] = useState<LeadMarketplaceItem | null>(null);
  const [message, setMessage] = useState('');
  const [submittingLeadId, setSubmittingLeadId] = useState('');

  const hasLeadAccess =
    user?.role === 'Contractor' &&
    !!user.isVerified &&
    !!user.subscriptionLevel &&
    user.subscriptionLevel !== 'none';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leadSnapshot, inquirySnapshot] = await Promise.all([
          getDocs(query(collection(db, 'lead_marketplace'), orderBy('createdAt', 'desc'))),
          user?.id
            ? getDocs(query(collection(db, 'lead_inquiries'), where('contractorId', '==', user.id)))
            : Promise.resolve({ docs: [] } as Awaited<ReturnType<typeof getDocs>>),
        ]);

        const rawLeads = leadSnapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<LeadMarketplaceItem, 'id'>),
        })) as LeadMarketplaceItem[];

        const hydratedLeads = await Promise.all(
          rawLeads.map(async (lead) => {
            if ((lead.photos?.length || 0) > 0 || (lead.photoCount || 0) === 0) {
              return lead;
            }

            try {
              const projectPhotosSnapshot = await getDocs(
                query(collection(db, 'projects', lead.leadId, 'photos'), orderBy('createdAt', 'asc'), limit(3))
              );
              const fallbackPhotos = projectPhotosSnapshot.docs.map((entry) => entry.data().url).filter(Boolean);
              if (fallbackPhotos.length > 0) {
                return { ...lead, photos: fallbackPhotos };
              }

              const projectSnapshot = await getDoc(doc(db, 'projects', lead.leadId));
              const projectPhotos = projectSnapshot.exists() ? ((projectSnapshot.data().photos as string[] | undefined) || []) : [];
              return projectPhotos.length > 0 ? { ...lead, photos: projectPhotos } : lead;
            } catch (syncError) {
              console.error('Error hydrating lead preview photos:', syncError);
              return lead;
            }
          })
        );

        setLeads(hydratedLeads);
        setInquiries(
          inquirySnapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<LeadInquiry, 'id'>),
          }))
        );
      } catch (error) {
        console.error('Error loading contractor leads:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [user?.id]);

  const categoryOptions = useMemo(
    () => ['All Categories', ...Array.from(new Set(leads.map((lead) => lead.category).filter(Boolean))).sort()],
    [leads]
  );

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesCategory = categoryFilter === 'All Categories' || lead.category === categoryFilter;
        const haystack = [
          lead.category,
          lead.description,
          lead.location?.town,
          lead.location?.zip,
        ]
          .join(' ')
          .toLowerCase();
        const matchesSearch = haystack.includes(queryText.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [leads, categoryFilter, queryText]
  );

  const requestedLeadIds = new Set(inquiries.map((inquiry) => inquiry.leadId));

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  };

  const submitInquiry = async () => {
    if (!user || !selectedLead) return;
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setSubmittingLeadId(selectedLead.id);
    try {
      await addDoc(collection(db, 'lead_inquiries'), {
        leadId: selectedLead.leadId,
        contractorId: user.id,
        contractorName: user.name,
        contractorEmail: user.email,
        message: trimmedMessage,
        status: 'Requested',
        createdAt: new Date().toISOString(),
      });

      setInquiries((current) => [
        ...current,
        {
          id: `${selectedLead.id}-${user.id}`,
          leadId: selectedLead.leadId,
          contractorId: user.id,
          contractorName: user.name,
          contractorEmail: user.email,
          message: trimmedMessage,
          status: 'Requested',
          createdAt: new Date().toISOString(),
        },
      ]);
      setLeads((current) =>
        current.map((lead) =>
          lead.id === selectedLead.id
            ? { ...lead, status: 'Requested', updatedAt: new Date().toISOString() }
            : lead
        )
      );
      setSelectedLead(null);
      setMessage('');
    } catch (error) {
      console.error('Error creating lead inquiry:', error);
      handleFirestoreError(error, OperationType.WRITE, 'lead_inquiries');
      alert('Could not send request through Blueprint.');
    } finally {
      setSubmittingLeadId('');
    }
  };

  if (!hasLeadAccess) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Lock size={24} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Lead Marketplace</h1>
          <p className="text-sm font-medium leading-7 text-slate-600">
            Verified contractors on an active plan can review homeowner leads. First contact stays inside Blueprint.
          </p>
          <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            <ShieldCheck size={14} />
            Verification and active subscription required
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Lead Marketplace</h1>
        <p className="text-sm font-medium text-slate-600">
          Homeowner contact details stay private. Submit a request through Blueprint to start the introduction.
        </p>
      </div>

      <div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Search Leads</span>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
              placeholder="Category, town, ZIP"
            />
          </div>
        </label>
        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filter By Category</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-primary"
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredLeads.map((lead) => {
            const alreadyRequested = requestedLeadIds.has(lead.leadId);

            return (
              <article key={lead.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Category</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{lead.category}</h2>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                      lead.status === 'Open'
                        ? 'bg-emerald-50 text-emerald-700'
                        : lead.status === 'Requested'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {lead.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {[lead.location?.town, lead.location?.zip].filter(Boolean).join(' ')}
                  </span>
                  <span>{formatDate(lead.createdAt)}</span>
                  <span>{lead.photoCount || 0} photos</span>
                </div>

                <p className="mt-4 line-clamp-4 text-sm font-medium leading-6 text-slate-600">
                  {lead.description}
                </p>

                {lead.photos?.[0] && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                    <img src={lead.photos[0]} alt={lead.category} className="h-44 w-full object-cover" />
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-xs font-medium text-slate-500">
                    Homeowner contact stays inside Blueprint until introduction is approved.
                  </p>
                  <button
                    type="button"
                    disabled={alreadyRequested}
                    onClick={() => {
                      setSelectedLead(lead);
                      setMessage(
                        `Blueprint team, I would like an introduction for this ${lead.category.toLowerCase()} lead in ${lead.location?.town || 'this area'}.`
                      );
                    }}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {alreadyRequested ? 'Requested' : 'Request Introduction'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredLeads.length === 0 && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-black text-slate-900">No leads available</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Try a different category or search.</p>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Blueprint Introduction Request</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{selectedLead.category}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500"
              >
                Close
              </button>
            </div>

            <label className="mt-6 block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Message To Blueprint</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-[160px] w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-primary"
              />
            </label>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs font-medium text-slate-500">
                Blueprint will handle first contact with the homeowner and enforce platform policy.
              </p>
              <button
                type="button"
                onClick={submitInquiry}
                disabled={!message.trim() || submittingLeadId === selectedLead.id}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingLeadId === selectedLead.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
