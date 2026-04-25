import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Database, Loader2, Search, ShieldCheck } from 'lucide-react';
import { ElevatorIntelligenceSourceStatus, ElevatorOpportunity } from '../types';
import { ElevatorIntelligencePayload, fetchElevatorIntelligence } from '../services/elevatorIntelligenceService';

function formatDate(value?: string) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString();
}

function formatCurrency(value?: number) {
  if (!value) return 'N/A';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function tierClasses(tier: ElevatorOpportunity['modernizationSignalTier']) {
  if (tier === 'High') return 'bg-emerald-100 text-emerald-800';
  if (tier === 'Medium') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function sourceLatestLabel(source: ElevatorIntelligenceSourceStatus) {
  if (!source.latestAt) return 'Live';
  if (/^\d{4}-\d{2}-\d{2}T/.test(source.latestAt)) return formatDate(source.latestAt);
  return 'Live';
}

export default function ElevatorModernizationIntelligence() {
  const [payload, setPayload] = useState<ElevatorIntelligencePayload | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ElevatorOpportunity | null>(null);
  const [boroughFilter, setBoroughFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const nextPayload = await fetchElevatorIntelligence();

        if (cancelled) return;

        setPayload(nextPayload);
        setSelectedOpportunity(nextPayload.opportunities[0] || null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load elevator intelligence.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const opportunities = payload?.opportunities || [];
  const sources = payload?.sources || [];
  const boroughOptions = ['ALL', ...new Set(opportunities.map((item) => item.borough).filter(Boolean))];
  const filteredOpportunities = opportunities.filter((item) => {
    if (boroughFilter !== 'ALL' && item.borough !== boroughFilter) {
      return false;
    }

    if (tierFilter !== 'ALL' && item.modernizationSignalTier !== tierFilter) {
      return false;
    }

    if (!searchQuery.trim()) {
      return true;
    }

    const query = searchQuery.trim().toLowerCase();
    const haystack = [
      item.jobFilingNumber,
      item.address,
      item.ownerName,
      item.managementCompany,
      item.recentRecordedParty,
      item.zipCode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  const highSignalCount = opportunities.filter((item) => item.modernizationSignalTier === 'High').length;

  useEffect(() => {
    if (!filteredOpportunities.length) {
      setSelectedOpportunity(null);
      return;
    }

    if (!selectedOpportunity || !filteredOpportunities.some((item) => item.id === selectedOpportunity.id)) {
      setSelectedOpportunity(filteredOpportunities[0]);
    }
  }, [filteredOpportunities, selectedOpportunity]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <Building2 size={14} />
          In-Motion Elevator Filings
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900">In-Motion Elevator Filings</h1>
        <p className="mt-4 max-w-4xl text-base font-medium leading-7 text-slate-600">
          A live view of filed elevator modernization and replacement activity with applicant company, cost, device context,
          and recent ownership signals. Use this as market visibility after a job has started moving.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/elevator-intelligence"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-sky-500/20 transition-transform hover:scale-[1.01]"
          >
            View Pre-Filing Opportunities
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Live Sources</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{sources.length}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Automatic public datasets now feeding this page.</p>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ranked Opportunities</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{opportunities.length}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Normalized from recent permit and building-history activity.</p>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">High Signal</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{highSignalCount}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Current filings scoring into the highest modernization tier.</p>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Last Refresh</p>
          <p className="mt-3 text-2xl font-black text-slate-900">{payload ? formatDate(payload.updatedAt) : 'Loading'}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Client-side refresh of the current automatic source stack.</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Automatic Source Intake</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Filed records, mapped logically</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            <Database size={14} />
            Official NYC Open Data
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {sources.map((source) => (
            <div
              key={source.key}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">{source.label}</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{source.note}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                <span className="rounded-full bg-white px-3 py-2">{source.count.toLocaleString()} rows</span>
                <span className="rounded-full bg-white px-3 py-2">Latest {sourceLatestLabel(source)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filing Feed</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Recent modernization filings</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                <Search size={16} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Address, owner, party, zip"
                  className="w-48 bg-transparent outline-none placeholder:text-slate-400"
                />
              </label>
              <select
                value={boroughFilter}
                onChange={(event) => setBoroughFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
              >
                {boroughOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All Boroughs' : option}
                  </option>
                ))}
              </select>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
              >
                {['ALL', 'High', 'Medium', 'Watch'].map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All Tiers' : option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">
              <Loader2 size={18} className="animate-spin" />
              Loading in-motion elevator filings.
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{error}</div>
          ) : !filteredOpportunities.length ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">
              No opportunities matched the current filters.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[62rem] table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <th className="pb-3 pr-4">Address</th>
                    <th className="pb-3 pr-4">Signal</th>
                    <th className="pb-3 pr-4">Estimated Cost</th>
                    <th className="pb-3 pr-4">Device</th>
                    <th className="pb-3 pr-4">Recent Sale</th>
                    <th className="pb-3">Filing</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opportunity) => (
                    <tr
                      key={opportunity.id}
                      onClick={() => setSelectedOpportunity(opportunity)}
                      className={`cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-slate-50 ${
                        selectedOpportunity?.id === opportunity.id ? 'bg-sky-50/60' : ''
                      }`}
                    >
                      <td className="py-4 pr-4">
                        <p className="font-black text-slate-900">{opportunity.address}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {opportunity.borough}
                          {opportunity.zipCode ? ` · ${opportunity.zipCode}` : ''}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${tierClasses(opportunity.modernizationSignalTier)}`}>
                            {opportunity.modernizationSignalTier}
                          </span>
                          <span className="text-lg font-black text-slate-900">{opportunity.modernizationSignalScore}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-500">{opportunity.signalSummary[0]}</p>
                      </td>
                      <td className="py-4 pr-4 text-sm font-semibold text-slate-700">{formatCurrency(opportunity.estimatedCost)}</td>
                      <td className="py-4 pr-4">
                        <p className="text-sm font-black text-slate-900">{opportunity.deviceStatus || 'Unmatched'}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {[opportunity.deviceType, opportunity.deviceId].filter(Boolean).join(' · ') || 'No device match'}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="text-sm font-black text-slate-900">{formatDate(opportunity.recentSaleDate)}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">{formatCurrency(opportunity.recentSaleAmount)}</p>
                      </td>
                      <td className="py-4">
                        <p className="text-sm font-black text-slate-900">{opportunity.jobFilingNumber}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{opportunity.applicantBusinessName || 'Applicant not matched'}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">{formatDate(opportunity.filingDate)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Filing</p>
              <h2 className="text-2xl font-black text-slate-900">{selectedOpportunity?.address || 'No selection'}</h2>
            </div>
          </div>

          {selectedOpportunity ? (
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${tierClasses(selectedOpportunity.modernizationSignalTier)}`}>
                  {selectedOpportunity.modernizationSignalTier}
                </span>
                <span className="text-3xl font-black text-slate-900">{selectedOpportunity.modernizationSignalScore}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Owner</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{selectedOpportunity.ownerName || 'N/A'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Recent Recorded Party</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{selectedOpportunity.recentRecordedParty || 'N/A'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Permit Status</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{selectedOpportunity.permitStatus || 'N/A'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estimated Cost</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{formatCurrency(selectedOpportunity.estimatedCost)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Latest CO</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(selectedOpportunity.latestCertificateOfOccupancyDate)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">HPD Registration</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(selectedOpportunity.hpdRegistrationDate)}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Why It Matters</p>
                <div className="mt-4 space-y-3">
                  {selectedOpportunity.signalSummary.map((signal) => (
                    <div key={signal} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                      {signal}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-sky-50 px-5 py-5 text-sm font-semibold leading-6 text-sky-900">
                <span className="font-black uppercase tracking-[0.16em]">Recommended Action:</span> {selectedOpportunity.recommendedAction}
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Raw Filing Context</p>
                <div className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
                  <p>
                    <span className="font-black text-slate-900">Job Filing:</span> {selectedOpportunity.jobFilingNumber}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">Applicant:</span> {selectedOpportunity.applicantBusinessName || 'N/A'}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">Filing Path:</span> {selectedOpportunity.filingIncludes || 'N/A'}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">Description:</span> {selectedOpportunity.descriptionOfWork || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">
              Select a filing from the feed to inspect its matched permit, building, and ownership context.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
