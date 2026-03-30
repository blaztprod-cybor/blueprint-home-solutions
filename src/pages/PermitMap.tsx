import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Loader2, MapPinned } from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchDOBPermits } from '../services/dobService';
import { DOBPermit } from '../types';

function formatPermitDate(value: string) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function addressForPermit(permit: DOBPermit) {
  return permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' ') || 'Permit Location';
}

function FitToPoints({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [map, points]);

  return null;
}

export default function PermitMap() {
  const [permits, setPermits] = useState<DOBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [boroughFilter, setBoroughFilter] = useState('All Boroughs');
  const [workTypeFilter, setWorkTypeFilter] = useState('All Work Types');
  const [zipCodeFilter, setZipCodeFilter] = useState('All ZIP Codes');
  const [selectedPermitId, setSelectedPermitId] = useState('');

  useEffect(() => {
    const loadPermits = async () => {
      setLoading(true);
      try {
        const data = await fetchDOBPermits(5000);
        setPermits(data);
      } finally {
        setLoading(false);
      }
    };

    void loadPermits();
  }, []);

  const mappablePermits = useMemo(
    () =>
      permits.filter((permit) => {
        const latitude = safeNumber(permit.latitude);
        const longitude = safeNumber(permit.longitude);
        return latitude !== null && longitude !== null && latitude !== 0 && longitude !== 0;
      }),
    [permits]
  );

  const boroughOptions = useMemo(
    () => ['All Boroughs', ...Array.from(new Set(mappablePermits.map((permit) => permit.borough).filter(Boolean))).sort()],
    [mappablePermits]
  );

  const workTypeOptions = useMemo(
    () => ['All Work Types', ...Array.from(new Set(mappablePermits.map((permit) => permit.job_type).filter(Boolean))).sort()],
    [mappablePermits]
  );

  const zipCodeOptions = useMemo(
    () => ['All ZIP Codes', ...Array.from(new Set(mappablePermits.map((permit) => permit.zip_code).filter(Boolean))).sort()],
    [mappablePermits]
  );

  const filteredPermits = useMemo(
    () =>
      mappablePermits.filter((permit) => {
        const boroughMatches = boroughFilter === 'All Boroughs' || permit.borough === boroughFilter;
        const workTypeMatches = workTypeFilter === 'All Work Types' || permit.job_type === workTypeFilter;
        const zipMatches = zipCodeFilter === 'All ZIP Codes' || permit.zip_code === zipCodeFilter;
        return boroughMatches && workTypeMatches && zipMatches;
      }),
    [mappablePermits, boroughFilter, workTypeFilter, zipCodeFilter]
  );

  const selectedPermit = filteredPermits.find((permit) => permit.id === selectedPermitId) ?? filteredPermits[0] ?? null;

  useEffect(() => {
    if (!filteredPermits.length) {
      setSelectedPermitId('');
      return;
    }
    if (!selectedPermitId || !filteredPermits.some((permit) => permit.id === selectedPermitId)) {
      setSelectedPermitId(filteredPermits[0].id);
    }
  }, [filteredPermits, selectedPermitId]);

  const points = useMemo(
    () =>
      filteredPermits
        .map((permit) => {
          const latitude = safeNumber(permit.latitude);
          const longitude = safeNumber(permit.longitude);
          return latitude !== null && longitude !== null ? ([latitude, longitude] as [number, number]) : null;
        })
        .filter((point): point is [number, number] => point !== null),
    [filteredPermits]
  );

  return (
    <div className="relative overflow-hidden rounded-[2rem]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: "url('/home-pro-trial-bg.jpg')", transform: 'scale(1.12)' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-white/72" />

      <div className="relative space-y-8 p-1">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Link to="/permit-feed" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
              <ChevronLeft size={18} />
              Back to Permit Feed
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20">
                <MapPinned size={22} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Permit Map</h1>
                              </div>
            </div>
          </div>

          <div className="grid w-full gap-4 md:max-w-4xl md:grid-cols-3">
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
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filter By ZIP Code</span>
              <select
                value={zipCodeFilter}
                onChange={(event) => setZipCodeFilter(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary"
              >
                {zipCodeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-primary" size={40} />
              <p className="font-bold text-slate-500">Loading permit map...</p>
            </div>
          </div>
        ) : filteredPermits.length === 0 ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">No mapped permits found</p>
              <p className="mt-2 text-sm text-slate-500">Try another borough filter.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/88 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mapped Permits</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{filteredPermits.length} permits issued in the last 14 days</p>
              </div>
              <div className="p-4">
                <div className="relative h-[640px] overflow-hidden rounded-[1.5rem] border border-slate-100 bg-slate-100">
                  <MapContainer center={[40.7128, -74.006]} zoom={10} scrollWheelZoom className="h-full w-full">
                    <TileLayer
                      attribution='Map data: &copy; OpenStreetMap contributors | Cartography: &copy; CARTO'
                      url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                      opacity={0.9}
                    />
                    <FitToPoints points={points} />
                    {filteredPermits.map((permit) => {
                      const latitude = safeNumber(permit.latitude);
                      const longitude = safeNumber(permit.longitude);
                      if (latitude === null || longitude === null) return null;

                      const isSelected = permit.id === selectedPermit?.id;

                      return (
                        <CircleMarker
                          key={permit.id}
                          center={[latitude, longitude]}
                          pathOptions={{
                            color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.92)',
                            weight: isSelected ? 2.5 : 1.4,
                            fillColor: isSelected ? '#7c3aed' : '#1d4ed8',
                            fillOpacity: isSelected ? 0.98 : 0.62,
                          }}
                          radius={isSelected ? 8 : 5}
                          eventHandlers={{
                            click: () => setSelectedPermitId(permit.id),
                          }}
                        >
                          <Popup>
                            <div className="min-w-[220px] space-y-1 text-sm">
                              <div className="font-bold text-slate-900">{addressForPermit(permit)}</div>
                              <div className="text-xs text-slate-500">{permit.borough}</div>
                              <div><span className="font-semibold">Code:</span> {permit.job_type || 'N/A'}</div>
                              <div><span className="font-semibold">Status:</span> {permit.permit_status || 'N/A'}</div>
                              <div><span className="font-semibold">Issued:</span> {formatPermitDate(permit.issuance_date)}</div>
                              <div><span className="font-semibold">Lat/Lng:</span> {latitude.toFixed(5)}, {longitude.toFixed(5)}</div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                  <div className="pointer-events-none absolute inset-0 bg-white/34" />
                </div>
              </div>
            </section>

            <aside className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/88 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Permit</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Tap a point to inspect permit details.</p>
              </div>

              {selectedPermit ? (
                <div className="space-y-6 p-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Address</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{addressForPermit(selectedPermit)}</h2>
                    <p className="mt-2 text-sm font-medium text-slate-500">{selectedPermit.borough}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Code</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">{selectedPermit.job_type}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Date Issued</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">{formatPermitDate(selectedPermit.issuance_date)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Status</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">{selectedPermit.permit_status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Borough</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">{selectedPermit.borough || 'N/A'}</p>
                    </div>
                  </div>

                  <Link
                    to="/permit-feed"
                    className="block rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-500/20"
                  >
                    Return to Permit Feed
                  </Link>
                </div>
              ) : (
                <div className="p-6">
                  <p className="text-sm font-medium text-slate-500">Select a permit point to view details.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
