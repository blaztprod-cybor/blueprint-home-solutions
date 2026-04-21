import { createClient } from '@supabase/supabase-js';

const CERTIFICATE_OF_OCCUPANCY_FILTER = 'certificate_of_occupancy';
const DOB_INTELLIGENCE_FILTER = 'dob_intelligence';

export function createSupabaseAdminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials are missing for filing feed.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function mapPermit(row) {
  return {
    id: row.id,
    borough: row.borough || 'N/A',
    house_number: row.house_no || '',
    street_name: row.street_name || '',
    address: row.address || [row.house_no, row.street_name].filter(Boolean).join(' '),
    zip_code: row.zip_code || '',
    latitude: typeof row.latitude === 'number' ? row.latitude : row.latitude ? Number(row.latitude) : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : row.longitude ? Number(row.longitude) : null,
    job_type: row.work_type || 'N/A',
    permit_status: row.permit_status || 'N/A',
    filing_date: row.approved_date || '',
    issuance_date: row.issued_date || '',
    job_description: row.job_description || 'No description provided',
    owner_name: row.owner_name || 'Private Owner',
    owner_business_name: row.owner_business_name || row.applicant_business_name || 'N/A',
    estimated_job_costs: typeof row.estimated_job_costs === 'number' ? row.estimated_job_costs : Number(row.estimated_job_costs || 0),
    applicant_license: row.applicant_license || '',
    contact_name: '',
    phone: '',
    source: row.source || '',
  };
}

export function isOccupancyJobType(jobType) {
  const normalized = String(jobType || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  return normalized === 'CO' || normalized.includes(' CO') || normalized.includes('CO ') || normalized.includes('OCCUPANCY');
}

export function isDobIntelligenceJobType(jobType) {
  const normalized = String(jobType || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  return [
    'ALT-CO',
    'ALTERATION CO',
    'ALTERATION',
    'FULL DEMOLITION',
    'NEW BUILDING',
  ].some((match) => normalized.includes(match));
}

/**
 * @param {any} query
 * @param {string | null | undefined} filter
 */
function applyPermitFilterQuery(query, filter) {
  if (filter === CERTIFICATE_OF_OCCUPANCY_FILTER) {
    return query.or('work_type.eq.CO,work_type.ilike.%CO%,work_type.ilike.%occupancy%');
  }

  if (filter === DOB_INTELLIGENCE_FILTER) {
    return query.or('work_type.ilike.%alt-co%,work_type.ilike.%alteration co%,work_type.ilike.%alteration%,work_type.ilike.%full demolition%,work_type.ilike.%new building%');
  }

  return query;
}

/**
 * @param {{ job_type?: string }} permit
 * @param {string | null | undefined} filter
 */
function matchesRequestedPermitFilter(permit, filter) {
  if (filter === CERTIFICATE_OF_OCCUPANCY_FILTER) {
    return isOccupancyJobType(permit.job_type);
  }

  if (filter === DOB_INTELLIGENCE_FILTER) {
    return isDobIntelligenceJobType(permit.job_type);
  }

  return true;
}

/**
 * @param {Array<{ filing_date?: string }>} permits
 * @param {Array<{ updated_at?: string }> | null | undefined} data
 * @param {string | null | undefined} filter
 */
function buildPermitFeedMeta(permits, data, filter) {
  return {
    source: 'supabase',
    count: permits.length,
    latestIssuedDate: permits[0]?.filing_date || null,
    latestUpdatedAt: Array.isArray(data) && data[0]?.updated_at ? data[0].updated_at : null,
    occupancyOnly: filter === CERTIFICATE_OF_OCCUPANCY_FILTER,
    dobIntelligenceOnly: filter === DOB_INTELLIGENCE_FILTER,
    filter: filter || 'all',
  };
}

/**
 * @param {{ limit?: number; occupancyOnly?: boolean; filter?: string | null }} [options]
 */
export async function fetchPermitRows({ limit = 20, occupancyOnly = false, filter } = {}) {
  const normalizedFilter = filter || (occupancyOnly ? CERTIFICATE_OF_OCCUPANCY_FILTER : null);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('dob_permits')
    .select(`
      id,
      borough,
      house_no,
      street_name,
      address,
      zip_code,
      latitude,
      longitude,
      work_type,
      permit_status,
      approved_date,
      issued_date,
      job_description,
      owner_name,
      owner_business_name,
      applicant_business_name,
      applicant_license,
      estimated_job_costs,
      source,
      updated_at
    `)
    .order('approved_date', { ascending: false });

  query = applyPermitFilterQuery(query, normalizedFilter);

  const { data, error } = await query.limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const permits = Array.isArray(data) ? data.map(mapPermit) : [];
  const filteredPermits = permits.filter((permit) => matchesRequestedPermitFilter(permit, normalizedFilter));

  return {
    permits: filteredPermits,
    meta: buildPermitFeedMeta(filteredPermits, data, normalizedFilter),
  };
}
