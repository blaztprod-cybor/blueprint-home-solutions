import { createClient } from '@supabase/supabase-js';

function createSupabaseAdminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials are missing for permit feed.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function mapPermit(row) {
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
    applicant_license: row.applicant_license || '',
    contact_name: '',
    phone: '',
  };
}

export const handler = async (event) => {
  const limitParam = Number.parseInt(event.queryStringParameters?.limit || '20', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 20;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
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
        updated_at
      `)
      .order('issued_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const permits = Array.isArray(data) ? data.map(mapPermit) : [];
    const latestIssuedDate = permits[0]?.issuance_date || null;
    const latestUpdatedAt = Array.isArray(data) && data[0]?.updated_at ? data[0].updated_at : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permits,
        meta: {
          source: 'supabase',
          count: permits.length,
          latestIssuedDate,
          latestUpdatedAt,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to load permit feed from Supabase',
      }),
    };
  }
};
