import { createClient } from '@supabase/supabase-js';

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

export async function fetchPermitRows({ limit, occupancyOnly = false }) {
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

  if (occupancyOnly) {
    query = query.or('work_type.eq.CO,work_type.ilike.%CO%,work_type.ilike.%occupancy%');
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const permits = Array.isArray(data) ? data.map(mapPermit) : [];
  const filteredPermits = occupancyOnly ? permits.filter((permit) => isOccupancyJobType(permit.job_type)) : permits;
  const latestIssuedDate = filteredPermits[0]?.filing_date || null;
  const latestUpdatedAt = Array.isArray(data) && data[0]?.updated_at ? data[0].updated_at : null;

  return {
    permits: filteredPermits,
    meta: {
      source: 'supabase',
      count: filteredPermits.length,
      latestIssuedDate,
      latestUpdatedAt,
      occupancyOnly,
    },
  };
}
