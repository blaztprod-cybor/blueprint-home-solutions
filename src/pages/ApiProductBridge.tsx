import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DOBPermit } from '../types';
import { authorizedApiFetch } from '../lib/authorizedApi';
import { useAuth } from '../AuthContext';
import { formatPermitPhase } from '../lib/utils';
import { fetchDOBPermits } from '../services/dobService';

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

function isDobIntelligenceJobType(jobType?: string) {
  const normalized = String(jobType || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  return ['ALT-CO', 'ALTERATION CO', 'ALTERATION', 'FULL DEMOLITION', 'NEW BUILDING'].some((match) => normalized.includes(match));
}

function formatPermitId(permit: DOBPermit) {
  const raw = String(permit.jobFilingNumber || permit.id || '').trim();
  return raw.replace(/^dob-now-/i, '').replace(/^bis-/i, '');
}

export default function ApiProductBridge() {
  const { user, logout } = useAuth();
  const PAGE_BUTTON_WINDOW = 8;
  const [filings, setFilings] = useState<DOBPermit[]>([]);
  const [meta, setMeta] = useState<OccupancyApiPayload['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessMode, setAccessMode] = useState<'protected' | 'preview'>('protected');
  const [limit, setLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [boroughFilter, setBoroughFilter] = useState('ALL');
  const [zipFilter, setZipFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [estimatedCostSort, setEstimatedCostSort] = useState<'none' | 'desc' | 'asc'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const syncingScrollRef = useRef<'top' | 'bottom' | null>(null);

  const boroughOptions = useMemo(
    () => ['ALL', ...new Set(filings.map((permit) => String(permit.borough || '').trim()).filter(Boolean).sort())],
    [filings],
  );

  const statusOptions = useMemo(
    () => ['ALL', ...new Set(filings.map((permit) => String(permit.permit_status || '').trim()).filter(Boolean).sort())],
    [filings],
  );

  const zipOptions = useMemo(
    () => ['ALL', ...new Set(filings.map((permit) => String(permit.zip_code || '').trim()).filter(Boolean).sort())],
    [filings],
  );

  const searchFilteredFilings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return filings.filter((permit) => {
      if (boroughFilter !== 'ALL' && permit.borough !== boroughFilter) {
        return false;
      }

      if (zipFilter !== 'ALL' && String(permit.zip_code || '').trim() !== zipFilter) {
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
        permit.zip_code,
        permit.owner_business_name,
        permit.owner_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [boroughFilter, filings, searchQuery, zipFilter]);

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
    const statusFiltered =
      statusFilter === 'ALL'
        ? searchFilteredFilings
        : searchFilteredFilings.filter((permit) => permit.permit_status === statusFilter);

    if (estimatedCostSort === 'none') {
      return statusFiltered;
    }

    return [...statusFiltered].sort((left, right) => {
      const leftCost = Number(left.estimated_job_costs || 0);
      const rightCost = Number(right.estimated_job_costs || 0);

      if (leftCost === rightCost) {
        return formatPermitId(left).localeCompare(formatPermitId(right));
      }

      return estimatedCostSort === 'desc' ? rightCost - leftCost : leftCost - rightCost;
    });
  }, [estimatedCostSort, searchFilteredFilings, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredFilings.length / limit));
  const currentPage = Math.min(page, totalPages);
  const currentPageWindowStart = Math.floor((currentPage - 1) / PAGE_BUTTON_WINDOW) * PAGE_BUTTON_WINDOW + 1;
  const visiblePageNumbers = Array.from(
    { length: Math.min(PAGE_BUTTON_WINDOW, totalPages - currentPageWindowStart + 1) },
    (_, index) => currentPageWindowStart + index,
  );
  const rows = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredFilings.slice(start, start + limit);
  }, [currentPage, filteredFilings, limit]);

  const loadPreviewFallback = async () => {
    const previewPermits = await fetchDOBPermits(5000);
    const previewFilings = previewPermits.filter((permit) => isDobIntelligenceJobType(permit.job_type));

    setFilings(previewFilings);
    setMeta({
      count: previewFilings.length,
      filter: 'dob_intelligence',
      source: 'permit-feed fallback',
    });
    setAccessMode('preview');
    setError('');
  };

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        setError('');
        setSyncMessage('');

        const response = await authorizedApiFetch('/api/dob-intelligence-filings?limit=5000', {
          method: 'GET',
          cache: 'no-store',
        });
        const raw = (await response.json().catch(() => null)) as OccupancyApiPayload | null;

        if (!response.ok) {
          const responseError = raw && 'error' in raw ? String((raw as any).error) : 'Could not load live DOB intelligence filings.';
          throw new Error(responseError);
        }

        const nextPermits = Array.isArray(raw?.filings) ? raw?.filings : Array.isArray(raw?.permits) ? raw?.permits : [];
        if (nextPermits.length === 0) {
          await loadPreviewFallback();
          setSyncMessage('Live DOB Intelligence returned 0 filings, so Blueprint loaded the permit-feed fallback.');
          return;
        }

        setFilings(nextPermits);
        setMeta({
          ...(raw?.meta || {}),
          count: nextPermits.length,
          filter: 'dob_intelligence',
          source: raw?.meta?.source || 'local-file',
        });
        setAccessMode('protected');
      } catch (previewError) {
        const message = previewError instanceof Error ? previewError.message : 'Could not load live DOB intelligence preview.';

        if (previewError instanceof Error && (message.includes('Failed to fetch') || message.includes('Could not load live DOB intelligence filings.'))) {
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
      setError('Sign in to view the DOB intelligence feed.');
      return;
    }

    void loadPreview();
  }, [refreshNonce, user]);

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
      const bottomScroller = bottomScrollRef.current;
      if (!bottomScroller) return;

      const measuredWidth = Math.max(
        tableRef.current?.scrollWidth || 0,
        bottomScroller.scrollWidth || 0,
        bottomScroller.clientWidth + 1,
      );

      setTableScrollWidth(measuredWidth);
    };

    updateScrollWidth();
    const animationFrameId = window.requestAnimationFrame(updateScrollWidth);

    const resizeObserver = new ResizeObserver(() => {
      updateScrollWidth();
    });

    resizeObserver.observe(bottomScrollRef.current);

    if (tableRef.current) {
      resizeObserver.observe(tableRef.current);
    }

    window.addEventListener('resize', updateScrollWidth);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollWidth);
    };
  }, [rows.length, filteredFilings.length, loading]);

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
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  };

  const formatCurrency = (value?: number) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  };

  const resetFilters = () => {
    setBoroughFilter('ALL');
    setZipFilter('ALL');
    setStatusFilter('ALL');
    setEstimatedCostSort('none');
    setSearchQuery('');
    setPage(1);
  };

  const statusSummaryLine = statusCounts
    .slice(0, 5)
    .map(({ status, count }) => `${count.toLocaleString()} ${status}`)
    .join(', ');

  const goToPreviousPageWindow = () => {
    setPage(Math.max(1, currentPageWindowStart - PAGE_BUTTON_WINDOW));
  };

  const goToNextPageWindow = () => {
    setPage(Math.min(totalPages, currentPageWindowStart + PAGE_BUTTON_WINDOW));
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');

      const response = await authorizedApiFetch('/api/admin/sync-permits', {
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as OccupancyApiPayload & { ok?: boolean; message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || 'Manual permit sync failed.');
      }

      setSyncMessage(payload?.message || 'Permit sync completed.');
      setRefreshNonce((current) => current + 1);
    } catch (syncError) {
      setSyncMessage(syncError instanceof Error ? syncError.message : 'Manual permit sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-[96rem] space-y-6">
        <div className="flex justify-center">
          <Link to="/" className="flex flex-col items-center">
            <img src="/logo.jpg" alt="Blueprint Home Solutions" className="h-24 w-auto rounded-2xl object-contain" />
          </Link>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-500">
              Signed in as <span className="font-bold text-slate-900">{user?.email || 'Unknown user'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/projects"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Home Pro Portal
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Log Out
              </button>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">DOB Intelligence</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              Source: {meta?.source || 'N/A'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              Latest filing: {formatDateTime(meta?.latestIssuedDate)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              Last sync: {formatDateTime(meta?.latestUpdatedAt)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              Feed mode: {accessMode}
            </span>
          </div>
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
                Zip
                <select
                  value={zipFilter}
                  onChange={(event) => setZipFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                >
                  {zipOptions.map((value) => (
                    <option key={value} value={value}>
                      {value === 'ALL' ? 'All zip codes' : value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                Estimated Cost
                <select
                  value={estimatedCostSort}
                  onChange={(event) => setEstimatedCostSort(event.target.value as 'none' | 'desc' | 'asc')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                >
                  <option value="none">Default</option>
                  <option value="desc">Highest first</option>
                  <option value="asc">Lowest first</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                Search
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ID, address, zip code, owner"
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
              <button
                type="button"
                onClick={() => void handleManualSync()}
                disabled={syncing}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Run Manual Sync'}
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

          {!loading && syncMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {syncMessage}
            </div>
          ) : null}

          {!loading && !error && filteredFilings.length > limit && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousPageWindow}
                disabled={currentPageWindowStart === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              {visiblePageNumbers.map((pageNumber) => (
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
              <button
                type="button"
                onClick={goToNextPageWindow}
                disabled={visiblePageNumbers[visiblePageNumbers.length - 1] >= totalPages}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {!loading && !error && statusSummaryLine && (
            <div className="mt-4 text-sm font-medium text-slate-600">{statusSummaryLine}</div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            {loading ? (
              <div className="flex items-center gap-3 bg-slate-950 p-5 text-sm font-medium text-slate-300">
                <Loader2 className="animate-spin" size={18} />
                Loading live DOB intelligence filings...
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
                  className="overflow-x-scroll border-b border-slate-200 bg-slate-100"
                >
                  <div className="h-4" style={{ width: `${tableScrollWidth || 1}px` }} />
                </div>
                <div
                  ref={bottomScrollRef}
                  onScroll={() => syncScroll('bottom')}
                  className="max-h-[65vh] overflow-auto bg-white"
                >
                  <table ref={tableRef} className="w-full min-w-[1280px] border-collapse text-left text-sm">
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
                          <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                            <div>
                              <div>{permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' ')}</div>
                              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                ZIP {permit.zip_code || 'N/A'}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{permit.job_type}</td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{formatPermitPhase(permit.permit_status)}</td>
                          <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-slate-700">{formatDate(permit.filing_date)}</td>
                          <td className="border-b border-slate-200 px-4 py-3 text-slate-700">{permit.owner_business_name || permit.owner_name}</td>
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
                onClick={goToPreviousPageWindow}
                disabled={currentPageWindowStart === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              {visiblePageNumbers.map((pageNumber) => (
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
              <button
                type="button"
                onClick={goToNextPageWindow}
                disabled={visiblePageNumbers[visiblePageNumbers.length - 1] >= totalPages}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
              <div className="px-2 text-sm font-medium text-slate-500">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
