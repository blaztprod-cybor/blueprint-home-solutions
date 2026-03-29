import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { fetchDOBPermits } from '../services/dobService';
import { DOBPermit } from '../types';
import { cn } from '../lib/utils';

export default function DOBLeads() {
  const ITEMS_PER_PAGE = 100;
  const [permits, setPermits] = useState<DOBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [boroughFilter, setBoroughFilter] = useState('All Boroughs');
  const [workTypeFilter, setWorkTypeFilter] = useState('All Work Types');
  const [currentPage, setCurrentPage] = useState(1);
  const [copyLabel, setCopyLabel] = useState('Copy For Paste');
  const [selectedPermitIds, setSelectedPermitIds] = useState<string[]>([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const scrollTableBy = (delta: number) => {
    tableScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchDOBPermits(5000);
      setPermits(data);
      setLoading(false);
    };
    loadData();
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

  const filteredPermits = permits.filter((permit) => {
    const matchesBorough = boroughFilter === 'All Boroughs' || permit.borough === boroughFilter;
    const matchesWorkType = workTypeFilter === 'All Work Types' || permit.job_type === workTypeFilter;
    return matchesBorough && matchesWorkType;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [boroughFilter, workTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPermits.length / ITEMS_PER_PAGE));
  const paginatedPermits = filteredPermits.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const allVisibleSelected = paginatedPermits.length > 0 && paginatedPermits.every((permit) => selectedPermitIds.includes(permit.id));

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (e.shiftKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loading, currentPage, permits.length, boroughFilter, workTypeFilter]);

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

  const handleCopyForPaste = async () => {
    const permitsToCopy = selectedPermitIds.length > 0
      ? paginatedPermits.filter((permit) => selectedPermitIds.includes(permit.id))
      : paginatedPermits;

    const lines = [
      ['Borough', 'Address', 'Street', 'Work Type', 'Status', 'Date Issued', 'Job Description', 'Company', 'Applicant License', 'Contact Name', 'Phone'].join('\t'),
      ...permitsToCopy.map((permit) => ([
        permit.borough,
        permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' '),
        permit.street_name,
        permit.job_type,
        permit.permit_status,
        formatPermitDate(permit.issuance_date),
        permit.job_description.replace(/\s+/g, ' ').trim(),
        permit.owner_business_name || permit.owner_name || 'Unavailable',
        permit.applicant_license || 'Unavailable',
        permit.contact_name || 'Not added yet',
        permit.phone || 'Not added yet',
      ].join('\t')))
    ];

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopyLabel('Copied');
    window.setTimeout(() => setCopyLabel('Copy For Paste'), 2000);
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Permit Feed Pages</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Showing {filteredPermits.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
          {' '}-{' '}
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredPermits.length)} of {filteredPermits.length}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopyForPaste}
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          {copyLabel}
        </button>

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
    <div className="space-y-8 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Permit Feed</h1>
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Live Feed</span>
          </div>
          <p className="text-muted-foreground">Real-time construction permits issued by the NYC Department of Buildings.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Map Setup</p>
          <p className="mt-1 text-xs font-bold text-slate-600">Use NYC Geoclient to geocode permit addresses for a map view.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0 w-full max-w-full">
        <div className="border-b border-slate-100 px-6 py-4">
          <PaginationControls />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
          <p className="text-xs text-slate-600 max-w-[min(100%,28rem)] leading-snug">
            <span className="font-semibold text-slate-700">Split window?</span>{' '}
            Drag the bar under the table, use the arrows, or scroll vertically with the mouse/trackpad while the pointer is over the table to move sideways.
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => scrollTableBy(-360)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Scroll table left"
            >
              <ChevronLeft size={16} />
              Left
            </button>
            <button
              type="button"
              onClick={() => scrollTableBy(360)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Scroll table right"
            >
              Right
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div ref={tableScrollRef} className="permit-feed-scroll min-w-0 w-full max-w-full pb-1">
          <table className="w-full text-left border-collapse min-w-[2100px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelections}
                    aria-label="Select all visible permit rows"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Borough</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Street</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Type / Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Issued</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Description</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applicant License</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-primary mb-4" size={40} />
                      <p className="font-bold text-slate-500">Processing NYC DOB Data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPermits.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-bold text-slate-700">No permits match these filters</p>
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
                        aria-label={`Select permit ${permit.address || permit.street_name}`}
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
                      <span className="text-sm font-medium text-slate-600">{permit.street_name || 'Unavailable'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className="inline-flex text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-700 rounded-lg uppercase tracking-widest">
                          {permit.job_type || 'N/A'}
                        </span>
                        <span className={cn(
                          "inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                          permit.permit_status === 'Permit Issued' || permit.permit_status === 'ISSUED'
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-50 text-slate-600"
                        )}>
                          {permit.permit_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg uppercase tracking-widest whitespace-nowrap">
                        {formatPermitDate(permit.issuance_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 italic max-w-md min-w-[260px]">
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
                        {permit.contact_name || 'Not added yet'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">
                        {permit.phone || 'Not added yet'}
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
    </div>
  );
}
