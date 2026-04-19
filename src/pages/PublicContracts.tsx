import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Loader2, MapPin, Phone, Search, UserRound } from 'lucide-react';
import { fetchPublicContracts } from '../services/publicContractsService';
import { PublicContractOpportunity } from '../types';

const DEFAULT_LOOKBACK_DAYS = 14;

interface PublicContractsState {
  summary: {
    hot_window_days: number;
    awarded_contracts: number;
  };
  awardedContracts: PublicContractOpportunity[];
  source?: {
    contracts?: string;
    vendors?: string;
  };
}

function formatCurrency(value?: number | null) {
  if (!Number.isFinite(Number(value))) return 'Unavailable';
  return Number(value).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function toDateInputValue(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export default function PublicContracts() {
  const defaultDateFrom = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<PublicContractsState | null>(null);
  const [queryText, setQueryText] = useState('');
  const [improvementTypeFilter, setImprovementTypeFilter] = useState('All Improvement Types');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await fetchPublicContracts();
        setPayload(data);
      } catch (loadError: any) {
        setError(loadError?.message || 'Could not load public contracts.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const improvementTypeOptions = useMemo(() => {
    const contracts = payload?.awardedContracts || [];
    return [
      'All Improvement Types',
      ...Array.from(new Set(contracts.flatMap((contract) => contract.improvement_types || []).filter(Boolean))).sort(),
    ];
  }, [payload?.awardedContracts]);

  const filteredContracts = useMemo(() => {
    const contracts = payload?.awardedContracts || [];

    return contracts.filter((contract) => {
      const search = queryText.trim().toLowerCase();
      const matchesSearch =
        !search ||
        [
          contract.title,
          contract.vendor_name,
          contract.contact_name,
          contract.vendor_address,
          contract.agency,
          ...(contract.improvement_types || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);

      const matchesImprovementType =
        improvementTypeFilter === 'All Improvement Types' ||
        (contract.improvement_types || []).includes(improvementTypeFilter);

      const registrationDate = contract.registration_date ? new Date(contract.registration_date) : null;
      const registrationTime = registrationDate && !Number.isNaN(registrationDate.getTime()) ? registrationDate.getTime() : null;
      const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
      const matchesDateFrom = fromTime == null || (registrationTime != null && registrationTime >= fromTime);
      const matchesDateTo = toTime == null || (registrationTime != null && registrationTime <= toTime);

      return matchesSearch && matchesImprovementType && matchesDateFrom && matchesDateTo;
    });
  }, [payload?.awardedContracts, queryText, improvementTypeFilter, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white px-8 py-16 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="mb-4 animate-spin text-primary" size={40} />
          <p className="font-bold text-slate-700">Loading recent awarded city contracts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-8 py-10 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Feed Error</p>
        <p className="mt-2 text-base font-semibold text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Public Contracts</h1>
        <p className="text-sm font-medium text-slate-600">
          Awarded city contracts relevant to Blueprint Home Solutions trades and improvement scopes, with the list
          defaulted to the last {DEFAULT_LOOKBACK_DAYS} days so newer awards show up first as hotter outreach targets.
        </p>
      </div>

      <div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Search Contracts</span>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search vendor, title, contact, address"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-primary"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Improvement Type</span>
          <select
            value={improvementTypeFilter}
            onChange={(event) => setImprovementTypeFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-primary"
          >
            {improvementTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Visible Contracts</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{filteredContracts.length.toLocaleString()}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">After filters</p>
        </div>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            max={dateTo || undefined}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            min={dateFrom || undefined}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="grid gap-4">
        {filteredContracts.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-700">No awarded contracts match those filters.</p>
          </div>
        ) : (
          filteredContracts.map((contract) => (
            <article key={contract.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                      <Building2 size={12} />
                      {contract.status || 'Registered'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      <CalendarDays size={12} />
                      {formatDate(contract.registration_date)}
                    </span>
                    {(contract.improvement_types || []).map((type) => (
                      <span
                        key={`${contract.id}-${type}`}
                        className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">{contract.title}</h2>
                  <p className="text-sm font-semibold text-slate-500">{contract.agency || 'Agency unavailable'}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-5 py-4 text-left lg:min-w-[220px]">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Contract Amount</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{formatCurrency(contract.amount)}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Company Name</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{contract.vendor_name || 'Unavailable'}</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Address Location</p>
                  <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-slate-800">
                    <MapPin className="mt-0.5 shrink-0 text-slate-400" size={14} />
                    <span>{contract.vendor_address || 'Unavailable'}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Contact Company Name</p>
                  <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-slate-800">
                    <UserRound className="mt-0.5 shrink-0 text-slate-400" size={14} />
                    <span>{contract.contact_name || 'Unavailable'}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Phone Number</p>
                  <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-slate-800">
                    <Phone className="mt-0.5 shrink-0 text-slate-400" size={14} />
                    <span>{contract.vendor_phone || 'Unavailable'}</span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
