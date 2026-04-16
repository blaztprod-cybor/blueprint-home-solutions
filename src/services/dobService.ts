import { DOBPermit } from '../types';

const NETLIFY_PERMIT_FEED = '/api/dob-permits';
const STATIC_PERMIT_FEED = '/data/permits.json';
const LICENSE_LOOKUP_FEED = '/data/license-lookup.json';

function normalizeLicenseKey(value: string | number | null | undefined): string {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const stripped = digitsOnly.replace(/^0+/, '');
  return stripped || digitsOnly || '';
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
              String(record.business_name || '').trim().toUpperCase(),
              {
                contact_name: record.contact_name || '',
                phone: record.phone || '',
              }
            ])
        );
      }
    }

    const liveResponse = await fetch(`${NETLIFY_PERMIT_FEED}?limit=${limit}`, { cache: 'no-store' });

    if (liveResponse.ok) {
      const payload = await liveResponse.json();
      const livePermits = Array.isArray(payload) ? payload : payload.permits;

      if (Array.isArray(livePermits) && livePermits.length > 0) {
        return livePermits.map((permit) => {
          const lookup =
            licenseLookup.get(normalizeLicenseKey(permit.applicant_license)) ||
            businessLookup.get(String(permit.owner_business_name || '').trim().toUpperCase());

          return {
            ...permit,
            contact_name: permit.contact_name || lookup?.contact_name || '',
            phone: permit.phone || lookup?.phone || '',
          };
        });
      }
    }

    const staticResponse = await fetch(STATIC_PERMIT_FEED, { cache: 'no-store' });

    if (staticResponse.ok) {
      const payload = await staticResponse.json();
      const staticPermits = Array.isArray(payload) ? payload : payload.permits;

      if (Array.isArray(staticPermits) && staticPermits.length > 0) {
        return staticPermits
          .map((permit) => {
            const lookup =
              licenseLookup.get(normalizeLicenseKey(permit.applicant_license)) ||
              businessLookup.get(String(permit.owner_business_name || '').trim().toUpperCase());

            return {
              ...permit,
              contact_name: permit.contact_name || lookup?.contact_name || '',
              phone: permit.phone || lookup?.phone || '',
            };
          })
          .slice(0, limit);
      }
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
