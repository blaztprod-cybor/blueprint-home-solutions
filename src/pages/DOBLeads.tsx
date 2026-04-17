import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { fetchDOBPermits } from '../services/dobService';
import { DOBPermit } from '../types';
import { cn } from '../lib/utils';
import { authorizedApiFetch } from '../lib/authorizedApi';
import { useAuth } from '../AuthContext';

export default function DOBLeads() {
  const { user } = useAuth();
  const ITEMS_PER_PAGE = 100;
  const PERMIT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  const [permits, setPermits] = useState<DOBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [boroughFilter, setBoroughFilter] = useState('All Boroughs');
  const [workTypeFilter, setWorkTypeFilter] = useState('All Work Types');
  const [sortOrder, setSortOrder] = useState<'none' | 'zip-asc' | 'zip-desc'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [emailLabel, setEmailLabel] = useState('Email Selected To Me');
  const [selectedPermitIds, setSelectedPermitIds] = useState<string[]>([]);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchDOBPermits(5000);
      setPermits(data);
      setLoading(false);
    };
    void loadData();
    const intervalId = window.setInterval(() => {
      void loadData();
    }, PERMIT_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
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

  const filteredPermits = permits
    .filter((permit) => {
      const matchesBorough = boroughFilter === 'All Boroughs' || permit.borough === boroughFilter;
      const matchesWorkType = workTypeFilter === 'All Work Types' || permit.job_type === workTypeFilter;
      const haystack = [
        permit.borough,
        permit.address,
        permit.house_number,
        permit.street_name,
        permit.zip_code,
        permit.job_type,
        permit.permit_status,
        permit.job_description,
        permit.owner_business_name,
        permit.owner_name,
        permit.applicant_license,
        permit.contact_name,
        permit.phone,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = haystack.includes(searchQuery.toLowerCase());
      return matchesBorough && matchesWorkType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortOrder === 'none') return 0;
      const left = Number(a.zip_code || 0);
      const right = Number(b.zip_code || 0);
      return sortOrder === 'zip-asc' ? left - right : right - left;
    });

  useEffect(() => {
    setCurrentPage(1);
  }, [boroughFilter, workTypeFilter, searchQuery, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredPermits.length / ITEMS_PER_PAGE));
  const paginatedPermits = filteredPermits.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const allVisibleSelected = paginatedPermits.length > 0 && paginatedPermits.every((permit) => selectedPermitIds.includes(permit.id));
  const permitsToEmail = selectedPermitIds.length > 0
    ? permits.filter((permit) => selectedPermitIds.includes(permit.id)).slice(0, 25)
    : paginatedPermits.slice(0, 25);

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

  const formatProjectedCost = (value?: number) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 'Unavailable';
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  };

  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => {
      const startPage = Math.min(
        Math.max(1, currentPage - 2),
        Math.max(1, totalPages - 4)
      );
      return startPage + index;
    }
  );

  const handleEmailSelected = async () => {
    if (permitsToEmail.length === 0) {
      window.alert('Select at least one filing first.');
      return;
    }

    try {
      setEmailLabel('Sending...');
      const response = await authorizedApiFetch('/api/email-selected-permits', {
        method: 'POST',
        body: JSON.stringify({
          permits: permitsToEmail.slice(0, 25),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to email selected filings');
      }

      setEmailLabel('Sent');
      setIsEmailPreviewOpen(false);
      window.setTimeout(() => setEmailLabel('Email Selected To Me'), 2000);
    } catch (emailError: any) {
      setEmailLabel('Email Selected To Me');
      window.alert(emailError.message || 'Could not email the selected filings right now.');
    }
  };

  const openEmailPreview = () => {
    if (permitsToEmail.length === 0) {
      window.alert('Select at least one filing first.');
      return;
    }

    setIsEmailPreviewOpen(true);
  };

  const togglePermitSelection = (permitId: string) => {
    setSelectedPermitIds((current) =>
      current.includes(permitId)
        ? current.filter((id) => id !== permitId)
        : [...current, permitId]
    );
  };

  const toggleVisibleSelections = () => {
    const visibleIds = paginatedPermits.map((permit) => permit.id);

    setSelectedPermitIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const PaginationControls = () => (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filing Leads Pages</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Showing {filteredPermits.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
          {' '}-{' '}
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredPermits.length)} of {filteredPermits.length}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user?.email && (
          <button
            type="button"
            onClick={openEmailPreview}
            className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.01]"
          >
            {emailLabel}
          </button>
        )}

        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>

        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => setCurrentPage(page)}
            className={cn(
              "h-11 min-w-[44px] rounded-xl border px-3 text-sm font-bold transition-colors",
              currentPage === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage === totalPages}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Filing Leads</h1>
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Live Feed</span>
          </div>
          <p className="text-muted-foreground">We make public filing data usable, earlier, cleaner, and more trustworthy than anyone wants to do themselves.</p>
        </div>
        <Link
          to="/permit-map"
          className="block rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-sm transition-colors hover:bg-slate-50"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Map Setup</p>
          <p className="mt-1 text-xs font-bold text-slate-600">Open filing map view</p>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <label className="space-y-2">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sort ZIP Code</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as 'none' | 'zip-asc' | 'zip-desc')}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary"
          >
            <option value="none">None</option>
            <option value="zip-asc">Low to High</option>
            <option value="zip-desc">High to Low</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <PaginationControls />
        </div>

        <div className="overflow-x-scroll pb-3">
          <table className="w-full text-left border-collapse min-w-[2480px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelections}
                    aria-label="Select all visible filing rows"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Borough</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ZIP</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Type / Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Filed</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projected Cost</th>
                <th className="w-[195px] px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Description</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Owner Entity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applicant License</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Licensed Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Licensed Phone</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Potential Owner</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Owner Phone</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={15} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-primary mb-4" size={40} />
                      <p className="font-bold text-slate-500">Processing NYC DOB filings...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPermits.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-bold text-slate-700">No filings match these filters</p>
                      <p className="mt-2 text-sm text-slate-500">Try a different borough or work type.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPermits.map((permit, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.01 }}
                    key={permit.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPermitIds.includes(permit.id)}
                        onChange={() => togglePermitSelection(permit.id)}
                        aria-label={`Select filing ${permit.address || permit.street_name}`}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700">{permit.borough}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                        {[permit.house_number, permit.street_name].filter(Boolean).join(' ') || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                        {permit.zip_code || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className="inline-flex text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-700 rounded-lg uppercase tracking-widest">
                          {permit.job_type || 'N/A'}
                        </span>
                        <span className={cn(
                          "inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                          permit.permit_status === 'Approved' || permit.permit_status === 'Permit Entire' || permit.permit_status === 'Filed'
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-50 text-slate-600"
                        )}>
                          {permit.permit_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg uppercase tracking-widest whitespace-nowrap">
                        {formatPermitDate(permit.filing_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                        {formatProjectedCost(permit.estimated_job_costs)}
                      </span>
                    </td>
                    <td className="w-[195px] px-6 py-4 align-top">
                      <p
                        className="w-[195px] text-xs italic text-slate-500 whitespace-normal break-words"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        "{permit.job_description}"
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                        {permit.owner_business_name || permit.owner_name || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">
                        {permit.applicant_license || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                        {permit.licensed_contact_name || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">
                        {permit.licensed_phone || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                        {permit.potential_owner_name || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">
                        {permit.potential_owner_phone || 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
                        permit.contact_confidence === 'Verified Contact'
                          ? "bg-emerald-50 text-emerald-600"
                          : permit.contact_confidence === 'Owner Path'
                            ? "bg-amber-50 text-amber-700"
                            : permit.contact_confidence === 'License Only'
                              ? "bg-blue-50 text-blue-600"
                              : "bg-slate-50 text-slate-600"
                      )}>
                        {permit.contact_confidence || 'Unresolved'}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredPermits.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4">
            <PaginationControls />
          </div>
        )}
      </div>

      {isEmailPreviewOpen && user?.email && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Email Preview</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Send selected filings to yourself</h2>
              <p className="mt-2 text-sm text-slate-500">
                This email will be sent to <span className="font-semibold text-slate-700">{user.email}</span>.
                {' '}You can forward it afterward if needed.
              </p>
            </div>

            <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-5">
              {permitsToEmail.map((permit) => (
                <div key={permit.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' ') || 'Address unavailable'}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {permit.borough || 'N/A'} · ZIP {permit.zip_code || 'Unavailable'}
                      </p>
                    </div>
                    <span className="inline-flex rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
                      {formatPermitDate(permit.filing_date)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {permit.job_type || 'N/A'} · {formatProjectedCost(permit.estimated_job_costs)} · {permit.owner_business_name || permit.owner_name || 'Unavailable'}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {permit.contact_confidence || 'Unresolved'} · License {permit.applicant_license || 'Unavailable'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {permit.job_description || 'No job description available.'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <p className="text-xs font-semibold text-slate-500">
                {permitsToEmail.length} filing{permitsToEmail.length === 1 ? '' : 's'} ready to send
              </p>
              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={() => setIsEmailPreviewOpen(false)}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleEmailSelected()}
                  className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.01]"
                >
                  {emailLabel === 'Sending...' ? 'Sending...' : 'Send To My Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
