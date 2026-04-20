import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DOBPermit } from '../types';
import { authorizedApiFetch } from '../lib/authorizedApi';
import { useAuth } from '../AuthContext';

type OccupancyApiPayload = {
  filings?: DOBPermit[];
  permits?: DOBPermit[];
  meta?: {
    count?: number;
    latestIssuedDate?: string | null;
    latestUpdatedAt?: string | null;
    source?: string;
    filter?: string;
  };
};

function isOccupancyJobType(jobType?: string) {
  const normalized = String(jobType || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  return normalized === 'CO' || normalized.includes(' CO') || normalized.includes('CO ') || normalized.includes('OCCUPANCY');
}

function formatPermitId(permit: DOBPermit) {
  const raw = String(permit.jobFilingNumber || permit.id || '').trim();
  return raw.replace(/^dob-now-/i, '').replace(/^bis-/i, '');
}

export default function ApiProductBridge() {
  const { user } = useAuth();
  const [filings, setFilings] = useState<DOBPermit[]>([]);
  const [meta, setMeta] = useState<OccupancyApiPayload['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessMode, setAccessMode] = useState<'protected' | 'preview'>('protected');
  const [limit, setLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [boroughFilter, setBoroughFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<'top' | 'bottom' | null>(null);

  const boroughOptions = useMemo(
    () => ['ALL', ...new Set(filings.map((permit) => String(permit.borough || '').trim()).filter(Boolean).sort())],
    [filings],
  );

  const statusOptions = useMemo(
    () => ['ALL', ...new Set(filings.map((permit) => String(permit.permit_status || '').trim()).filter(Boolean).sort())],
    [filings],
  );

  const searchFilteredFilings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return filings.filter((permit) => {
      if (boroughFilter !== 'ALL' && permit.borough !== boroughFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        formatPermitId(permit),
        permit.address,
        permit.house_number,
        permit.street_name,
        permit.owner_business_name,
        permit.owner_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [boroughFilter, filings, searchQuery]);

  const statusCounts = useMemo(
    () =>
      [...new Map(
        searchFilteredFilings
          .map((permit) => String(permit.permit_status || 'Unknown').trim() || 'Unknown')
          .map((status) => [status, 0]),
      ).keys()]
        .map((status) => ({
          status,
          count: searchFilteredFilings.filter((permit) => (String(permit.permit_status || 'Unknown').trim() || 'Unknown') === status).length,
        }))
        .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
    [searchFilteredFilings],
  );

  const filteredFilings = useMemo(() => {
    if (statusFilter === 'ALL') {
      return searchFilteredFilings;
    }

    return searchFilteredFilings.filter((permit) => permit.permit_status === statusFilter);
  }, [searchFilteredFilings, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredFilings.length / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredFilings.slice(start, start + limit);
  }, [currentPage, filteredFilings, limit]);

  const loadPreviewFallback = async () => {
    const previewResponse = await fetch('/api/dob-permits?limit=5000', { cache: 'no-store' });
    const previewPayload = (await previewResponse.json().catch(() => null)) as OccupancyApiPayload | null;
    const previewPermits = Array.isArray(previewPayload?.permits) ? previewPayload?.permits : [];
    const previewFilings = previewPermits.filter((permit) => isOccupancyJobType(permit.job_type));

    setFilings(previewFilings);
    setMeta({
      ...(previewPayload?.meta || {}),
      count: previewFilings.length,
      filter: 'certificate_of_occupancy',
      source: `${previewPayload?.meta?.source || 'local-file'} (preview fallback)`,
    });
    setAccessMode('preview');
    setError('');
  };

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        setError('');

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 4000);
        const response = await authorizedApiFetch('/api/recent-occupancy-filings?limit=200', {
          method: 'GET',
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);
        const raw = (await response.json().catch(() => null)) as OccupancyApiPayload | null;

        if (!response.ok) {
          const responseError = raw && 'error' in raw ? String((raw as any).error) : 'Could not load live occupancy filings.';

          if (response.status === 403 && responseError.includes('API access is not enabled')) {
            await loadPreviewFallback();
            return;
          }

          throw new Error(responseError);
        }

        const nextFilings = Array.isArray(raw?.filings) ? raw?.filings : Array.isArray(raw?.permits) ? raw?.permits : [];
        setFilings(nextFilings);
        setMeta(raw?.meta || null);
        setAccessMode('protected');
      } catch (previewError) {
        const message = previewError instanceof Error ? previewError.message : 'Could not load live API preview.';

        if (previewError instanceof Error && (previewError.name === 'AbortError' || message.includes('Failed to fetch'))) {
          try {
            await loadPreviewFallback();
            return;
          } catch (fallbackError) {
            setError(fallbackError instanceof Error ? fallbackError.message : 'Could not load preview fallback.');
            return;
          }
        }

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (!user) {
      setLoading(false);
      setError('Sign in to view the live occupancy endpoint preview.');
      return;
    }

    void loadPreview();
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [boroughFilter, statusFilter, searchQuery, limit]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!bottomScrollRef.current) return;

    const updateScrollWidth = () => {
      setTableScrollWidth(bottomScrollRef.current?.scrollWidth || 0);
    };

    updateScrollWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollWidth();
    });

    resizeObserver.observe(bottomScrollRef.current);

    const table = bottomScrollRef.current.querySelector('table');
    if (table) {
      resizeObserver.observe(table);
    }

    window.addEventListener('resize', updateScrollWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollWidth);
    };
  }, [rows.length, loading]);

  const syncScroll = (source: 'top' | 'bottom') => {
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!top || !bottom) return;

    if (syncingScrollRef.current && syncingScrollRef.current !== source) {
      return;
    }

    syncingScrollRef.current = source;

    if (source === 'top') {
      bottom.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = bottom.scrollLeft;
    }

    window.requestAnimationFrame(() => {
      syncingScrollRef.current = null;
    });
  };

  const formatDate = (value?: string | null) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const formatCurrency = (value?: number) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  };

  const resetFilters = () => {
    setBoroughFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    setPage(1);
  };

  const statusSummaryLine = statusCounts
    .slice(0, 5)
    .map(({ status, count }) => `${count.toLocaleString()} ${status}`)
    .join(', ');

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-6xl space-y-6">
        <div className="flex justify-center">
          <Link to="/" className="flex flex-col items-center">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-24 w-auto rounded-2xl object-contain" />
          </Link>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">DOB CO Intelligence</h1>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                Borough
                <select
                  value={boroughFilter}
                  onChange={(event) => setBoroughFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                >
                  {boroughOptions.map((value) => (
                    <option key={value} value={value}>
                      {value === 'ALL' ? 'All boroughs' : value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                >
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {value === 'ALL' ? 'All statuses' : value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                Search
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ID, address, owner"
                  className="w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
              Rows
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
              >
                {[100].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          {!loading && !error && filteredFilings.length > limit && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    pageNumber === currentPage
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          )}

          {!loading && !error && statusSummaryLine && (
            <div className="mt-4 text-sm font-medium text-slate-600">{statusSummaryLine}</div>
          )}

          {accessMode === 'preview' && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              This account does not have API access enabled, so this page is showing a real occupancy-data preview from the local permit feed instead of the protected API response.
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            {loading ? (
              <div className="flex items-center gap-3 bg-slate-950 p-5 text-sm font-medium text-slate-300">
                <Loader2 className="animate-spin" size={18} />
                Loading live occupancy filings...
              </div>
            ) : error ? (
              <div className="bg-slate-950 p-5">
                <p className="text-sm font-medium text-rose-300">{error}</p>
              </div>
            ) : (
              <>
                <div
                  ref={topScrollRef}
                  onScroll={() => syncScroll('top')}
                  className="overflow-x-auto border-b border-slate-200 bg-slate-100"
                >
                  <div className="h-4" style={{ width: `${tableScrollWidth}px` }} />
                </div>
                <div
                  ref={bottomScrollRef}
                  onScroll={() => syncScroll('bottom')}
                  className="max-h-[65vh] overflow-auto bg-white"
                >
                  <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-900 text-slate-100">
                    <tr>
                      {['ID', 'Borough', 'Address', 'Job Type', 'Status', 'Filing Date', 'Owner Business', 'Estimated Cost'].map((label) => (
                        <th key={label} className="whitespace-nowrap border-b border-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="border-b border-slate-200 px-4 py-8 text-center text-sm font-medium text-slate-500">
                          No filings match the current filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((permit, index) => (
                        <tr key={permit.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-mono text-xs text-slate-700">{formatPermitId(permit)}</td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">{permit.borough}</td>
                          <td className="min-w-[260px] border-b border-slate-200 px-4 py-3 text-slate-700">
                            {permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' ')}
                          </td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{permit.job_type}</td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{permit.permit_status}</td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{formatDate(permit.filing_date)}</td>
                          <td className="min-w-[220px] border-b border-slate-200 px-4 py-3 text-slate-700">{permit.owner_business_name || permit.owner_name}</td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{formatCurrency(permit.estimated_job_costs)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

          {!loading && !error && filteredFilings.length > limit && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <div className="px-2 text-sm font-medium text-slate-500">
                Page {currentPage} of {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
