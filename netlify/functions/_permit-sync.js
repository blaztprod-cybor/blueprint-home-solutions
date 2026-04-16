import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const BOROUGHS = [
  'QUEENS',
  'BROOKLYN',
  'MANHATTAN',
  'BRONX',
  'STATEN ISLAND',
];

const DEFAULT_LIMIT = Number(process.env.DOB_LIMIT || 5000);
const BIS_FILING_URL = 'https://data.cityofnewyork.us/resource/ic3t-wcy2.json';
const DOB_NOW_FILING_URL = 'https://data.cityofnewyork.us/resource/w9ak-ipjd.json';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getBusinessDaysBackDate(daysBack) {
  const date = new Date();
  let remaining = daysBack;

  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return formatDate(date);
}

function getDefaultStartDate() {
  return process.env.DOB_START_DATE || getBusinessDaysBackDate(20);
}

function buildBisUrl(borough, startDate) {
  const params = new URLSearchParams({
    '$select': 'job__,doc__,borough,house__,street_name,job_type,job_status,job_status_descrp,latest_action_date,initial_cost,owner_s_business_name,owner_s_first_name,owner_s_last_name,applicant_license__,other_description,zip,gis_latitude,gis_longitude,community___board,gis_council_district,gis_census_tract,gis_nta_name,pre__filing_date',
    '$where': `borough='${borough}'`,
    '$order': 'pre__filing_date DESC',
    '$limit': String(DEFAULT_LIMIT),
  });

  return `${BIS_FILING_URL}?${params.toString()}`;
}

function buildDobNowUrl(borough, startDate) {
  const params = new URLSearchParams({
    '$select': 'job_filing_number,filing_status,house_no,street_name,borough,job_type,filing_date,current_status_date,first_permit_date,approved_date,initial_cost,owner_s_business_name,applicant_license,work_on_floor,building_type,zip,latitude,longitude,commmunity_board,council_district,census_tract,nta',
    '$where': `borough='${borough}' AND filing_date >= '${startDate}'`,
    '$order': 'filing_date DESC',
    '$limit': String(DEFAULT_LIMIT),
  });

  return `${DOB_NOW_FILING_URL}?${params.toString()}`;
}

function excelSerialToIso(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';

  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const converted = new Date(excelEpoch.getTime() + numeric * 86400000);
  return Number.isNaN(converted.getTime()) ? '' : converted.toISOString();
}

function normalizeDate(value) {
  if (!value) return '';

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 20000) {
    return excelSerialToIso(value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeCurrencyNumber(value) {
  const normalized = String(value || '').replace(/[^0-9.-]/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeBisFiling(row) {
  const ownerName = [row.owner_s_first_name, row.owner_s_last_name].filter(Boolean).join(' ').trim();

  return {
    id: `bis-${row.job__ || randomUUID()}-${row.doc__ || '01'}`,
    jobFilingNumber: row.job__ || '',
    workPermit: '',
    sequenceNumber: row.doc__ || '',
    filingReason: '',
    borough: row.borough || 'N/A',
    house_number: row.house__ || '',
    street_name: row.street_name || '',
    address: [row.house__, row.street_name].filter(Boolean).join(' '),
    job_type: row.job_type || 'N/A',
    permit_status: row.job_status_descrp || row.job_status || 'N/A',
    filing_date: normalizeDate(row.pre__filing_date),
    issuance_date: normalizeDate(row.latest_action_date),
    expiration_date: '',
    job_description: row.other_description || 'No description provided',
    estimated_job_costs: normalizeCurrencyNumber(row.initial_cost),
    owner_name: ownerName || 'Private Owner',
    owner_business_name: row.owner_s_business_name || ownerName || 'N/A',
    applicant_business_name: row.owner_s_business_name || ownerName || 'N/A',
    applicant_license: row.applicant_license__ || '',
    zip_code: row.zip || '',
    latitude: row.gis_latitude ? Number(row.gis_latitude) : null,
    longitude: row.gis_longitude ? Number(row.gis_longitude) : null,
    community_board: row.community___board || '',
    council_district: row.gis_council_district || '',
    bbl: '',
    census_tract: row.gis_census_tract || '',
    nta: row.gis_nta_name || '',
    source: 'NYC DOB Job Application Filings',
  };
}

function normalizeDobNowFiling(row) {
  return {
    id: `dob-now-${row.job_filing_number || randomUUID()}`,
    jobFilingNumber: row.job_filing_number || '',
    workPermit: '',
    sequenceNumber: '',
    filingReason: '',
    borough: row.borough || 'N/A',
    house_number: row.house_no || '',
    street_name: row.street_name || '',
    address: [row.house_no, row.street_name].filter(Boolean).join(' '),
    job_type: row.job_type || 'N/A',
    permit_status: row.filing_status || 'N/A',
    filing_date: normalizeDate(row.filing_date),
    issuance_date: normalizeDate(row.current_status_date || row.first_permit_date || row.approved_date),
    expiration_date: '',
    job_description: [row.building_type, row.work_on_floor].filter(Boolean).join(' | ') || 'No description provided',
    estimated_job_costs: normalizeCurrencyNumber(row.initial_cost),
    owner_name: row.owner_s_business_name || 'Private Owner',
    owner_business_name: row.owner_s_business_name || 'N/A',
    applicant_business_name: row.owner_s_business_name || 'N/A',
    applicant_license: row.applicant_license || '',
    zip_code: row.zip || '',
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    community_board: row.commmunity_board || '',
    council_district: row.council_district || '',
    bbl: '',
    census_tract: row.census_tract || '',
    nta: row.nta || '',
    source: 'NYC DOB NOW Build Job Application Filings',
  };
}

function normalizeText(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDedupeKey(permit) {
  return [
    normalizeText(permit.borough),
    normalizeText(permit.address),
    Number(permit.estimated_job_costs || 0),
    permit.filing_date || '',
    normalizeText(permit.job_description),
  ].join('|');
}

function dedupePermits(permits) {
  const deduped = new Map();

  for (const permit of permits) {
    const key = buildDedupeKey(permit);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, permit);
      continue;
    }

    const existingSequence = Number(existing.sequenceNumber || 0);
    const nextSequence = Number(permit.sequenceNumber || 0);

    if (nextSequence > existingSequence) {
      deduped.set(key, permit);
    }
  }

  return Array.from(deduped.values());
}

async function fetchBisFilingsForBorough(borough, startDate) {
  const response = await fetch(buildBisUrl(borough, startDate));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DOB BIS filing fetch failed for ${borough}: ${response.status} ${body}`);
  }

  const data = await response.json();
  const minDate = new Date(startDate).getTime();

  return data
    .map(normalizeBisFiling)
    .filter((filing) => {
      const filingTime = new Date(filing.filing_date).getTime();
      return Number.isFinite(filingTime) && filingTime >= minDate;
    });
}

async function fetchDobNowFilingsForBorough(borough, startDate) {
  const response = await fetch(buildDobNowUrl(borough, startDate));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DOB NOW filing fetch failed for ${borough}: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.map(normalizeDobNowFiling);
}

function toSupabaseRow(permit) {
  return {
    id: permit.id,
    job_filing_number: permit.jobFilingNumber,
    work_permit: permit.workPermit,
    sequence_number: permit.sequenceNumber ? Number(permit.sequenceNumber) : null,
    filing_reason: permit.filingReason,
    borough: permit.borough,
    house_no: permit.house_number,
    street_name: permit.street_name,
    address: permit.address,
    work_type: permit.job_type,
    permit_status: permit.permit_status,
    approved_date: permit.filing_date || null,
    issued_date: permit.issuance_date || null,
    expired_date: permit.expiration_date || null,
    job_description: permit.job_description,
    estimated_job_costs: permit.estimated_job_costs,
    owner_name: permit.owner_name,
    owner_business_name: permit.owner_business_name,
    applicant_business_name: permit.applicant_business_name,
    applicant_license: permit.applicant_license || null,
    zip_code: permit.zip_code || null,
    latitude: permit.latitude,
    longitude: permit.longitude,
    community_board: permit.community_board || null,
    council_district: permit.council_district || null,
    bbl: permit.bbl || null,
    census_tract: permit.census_tract || null,
    nta: permit.nta || null,
    source: permit.source,
    updated_at: new Date().toISOString(),
  };
}

export async function syncPermitsToSupabase(permits) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase credentials missing. Skipping Supabase sync.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dedupedRows = Array.from(
    new Map(
      permits
        .map(toSupabaseRow)
        .map((row) => [row.id, row])
    ).values()
  );
  const chunkSize = 500;

  for (let index = 0; index < dedupedRows.length; index += chunkSize) {
    const chunk = dedupedRows.slice(index, index + chunkSize);
    const { error } = await supabase
      .from('dob_permits')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
}

export async function fetchAndNormalizePermits() {
  const startDate = getDefaultStartDate();
  const boroughResults = await Promise.all(
    BOROUGHS.flatMap((borough) => [
      fetchBisFilingsForBorough(borough, startDate),
      fetchDobNowFilingsForBorough(borough, startDate),
    ])
  );

  const permits = dedupePermits(boroughResults.flat())
    .sort((a, b) => {
      const dateDiff = new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime();
      if (dateDiff !== 0) return dateDiff;

      const sequenceDiff = Number(b.sequenceNumber || 0) - Number(a.sequenceNumber || 0);
      if (sequenceDiff !== 0) return sequenceDiff;

      return a.address.localeCompare(b.address);
    });

  return {
    generatedAt: new Date().toISOString(),
    source: 'NYC DOB Job Application Filings',
    startDate,
    boroughs: BOROUGHS,
    count: permits.length,
    permits,
  };
}

export async function syncDobPermits() {
  const payload = await fetchAndNormalizePermits();
  await syncPermitsToSupabase(payload.permits);
  return payload;
}
