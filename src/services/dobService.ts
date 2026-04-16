import { DOBPermit } from '../types';

const NETLIFY_PERMIT_FEED = '/api/dob-permits';
const STATIC_PERMIT_FEED = '/data/permits.json';
const LICENSE_LOOKUP_FEED = '/data/license-lookup.json';

function normalizeLicenseKey(value: string | number | null | undefined): string {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const stripped = digitsOnly.replace(/^0+/, '');
  return stripped || digitsOnly || '';
}

function normalizeBusinessKey(value: string | null | undefined): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[.,#&/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchDOBPermits(limit = 20): Promise<DOBPermit[]> {
  try {
    const licenseLookupResponse = await fetch(LICENSE_LOOKUP_FEED, { cache: 'no-store' });
    let licenseLookup = new Map<string, { contact_name?: string; phone?: string }>();
    let businessLookup = new Map<string, { contact_name?: string; phone?: string }>();

    if (licenseLookupResponse.ok) {
      const lookupPayload = await licenseLookupResponse.json();
      const records = Array.isArray(lookupPayload) ? lookupPayload : lookupPayload.records;

      if (Array.isArray(records)) {
        licenseLookup = new Map(
          records
            .filter((record: any) => normalizeLicenseKey(record.license_number))
            .map((record: any) => [
              normalizeLicenseKey(record.license_number),
              {
                contact_name: record.contact_name || '',
                phone: record.phone || '',
              }
            ])
        );

        businessLookup = new Map(
          records
            .filter((record: any) => String(record.business_name || '').trim())
            .map((record: any) => [
              normalizeBusinessKey(record.business_name),
              {
                contact_name: record.contact_name || '',
                phone: record.phone || '',
              }
            ])
        );
      }
    }

    const enrichPermits = (permits: DOBPermit[]) =>
      permits.map((permit) => {
        const lookup =
          licenseLookup.get(normalizeLicenseKey(permit.applicant_license)) ||
          businessLookup.get(normalizeBusinessKey(permit.owner_business_name)) ||
          businessLookup.get(normalizeBusinessKey(permit.applicant_business_name)) ||
          businessLookup.get(normalizeBusinessKey(permit.owner_name));

        return {
          ...permit,
          contact_name: permit.contact_name || lookup?.contact_name || '',
          phone: permit.phone || lookup?.phone || '',
        };
      });

    const [liveResponse, staticResponse] = await Promise.all([
      fetch(`${NETLIFY_PERMIT_FEED}?limit=${limit}`, { cache: 'no-store' }).catch(() => null),
      fetch(STATIC_PERMIT_FEED, { cache: 'no-store' }).catch(() => null),
    ]);

    const livePayload = liveResponse?.ok ? await liveResponse.json() : null;
    const livePermits = Array.isArray(livePayload) ? livePayload : livePayload?.permits;
    const enrichedLivePermits = Array.isArray(livePermits) ? enrichPermits(livePermits) : [];

    const staticPayload = staticResponse?.ok ? await staticResponse.json() : null;
    const staticPermits = Array.isArray(staticPayload) ? staticPayload : staticPayload?.permits;
    const enrichedStaticPermits = Array.isArray(staticPermits) ? enrichPermits(staticPermits).slice(0, limit) : [];

    if (enrichedStaticPermits.length > enrichedLivePermits.length) {
      return enrichedStaticPermits;
    }

    if (enrichedLivePermits.length > 0) {
      return enrichedLivePermits;
    }

    if (enrichedStaticPermits.length > 0) {
      return enrichedStaticPermits;
    }

    return getMockData(limit);
  } catch (error) {
    console.error('Error fetching DOB permits:', error);
    return getMockData(limit);
  }
}

function getMockData(limit: number): DOBPermit[] {
  const jobTypes = ['NB', 'A1', 'A2', 'A3', 'DM'];
  const boroughs = ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND'];
  const streets = ['Broadway', '5th Ave', 'Main St', 'Park Ave', 'Lexington Ave', 'Atlantic Ave'];
  
  return Array.from({ length: limit }).map((_, i) => ({
    id: `MOCK-${Math.random().toString(36).substr(2, 9)}`,
    borough: boroughs[Math.floor(Math.random() * boroughs.length)],
    house_number: Math.floor(Math.random() * 2000).toString(),
    street_name: streets[Math.floor(Math.random() * streets.length)],
    job_type: jobTypes[Math.floor(Math.random() * jobTypes.length)],
    permit_status: 'Filed',
    filing_date: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    issuance_date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
    job_description: 'Renovation of existing structure including plumbing and electrical work.',
    owner_name: 'Property Owner LLC',
    owner_business_name: 'Real Estate Management',
    estimated_job_costs: Math.round(Math.random() * 500000),
    source: 'Mock DOB filing data',
  }));
}
