import { DOBPermit } from '../types';

const NETLIFY_PERMIT_FEED = '/api/dob-permits';
const STATIC_PERMIT_FEED = '/data/permits.json';
const LICENSE_LOOKUP_FEED = '/data/license-lookup.json';
const CONTACT_OVERRIDE_FEED = '/data/permit-contact-overrides.json';

function normalizeLicenseKey(value: string | number | null | undefined): string {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const stripped = digitsOnly.replace(/^0+/, '');
  return stripped || digitsOnly || '';
}

function buildPermitOverrideKey(jobFilingNumber?: string, address?: string): string {
  return `${String(jobFilingNumber || '').trim().toUpperCase()}|${String(address || '').trim().toUpperCase()}`;
}

export async function fetchDOBPermits(limit = 20): Promise<DOBPermit[]> {
  try {
    const licenseLookupResponse = await fetch(LICENSE_LOOKUP_FEED, { cache: 'no-store' });
    const contactOverrideResponse = await fetch(CONTACT_OVERRIDE_FEED, { cache: 'no-store' }).catch(() => null);
    let licenseLookup = new Map<string, { contact_name?: string; phone?: string; business_name?: string; license_status?: string; license_type?: string }>();
    let contactOverrides = new Map<string, Partial<DOBPermit>>();

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
                business_name: record.business_name || '',
                license_status: record.license_status || '',
                license_type: record.license_type || '',
              }
            ])
        );
      }
    }

    if (contactOverrideResponse?.ok) {
      const overridePayload = await contactOverrideResponse.json();
      const overrideRecords = Array.isArray(overridePayload) ? overridePayload : overridePayload.records;

      if (Array.isArray(overrideRecords)) {
        contactOverrides = new Map(
          overrideRecords.map((record: any) => [
            buildPermitOverrideKey(record.job_filing_number, record.address),
            {
              owner_name: record.owner_name || '',
              owner_business_name: record.owner_business_name || '',
              applicant_business_name: record.applicant_business_name || '',
              potential_owner_name: record.potential_owner_name || '',
              potential_owner_phone: record.potential_owner_phone || '',
              owner_path_source: record.owner_path_source || '',
            },
          ])
        );
      }
    }

    const enrichPermits = (permits: DOBPermit[]) =>
      permits.map((permit) => {
        const override =
          contactOverrides.get(buildPermitOverrideKey((permit as any).jobFilingNumber, permit.address)) ||
          contactOverrides.get(buildPermitOverrideKey((permit as any).jobFilingNumber, [permit.house_number, permit.street_name].filter(Boolean).join(' ')));
        const lookup = licenseLookup.get(normalizeLicenseKey(permit.applicant_license));
        const licensedContactName = lookup?.contact_name || '';
        const licensedPhone = lookup?.phone || '';
        const potentialOwnerName = override?.potential_owner_name || '';
        const potentialOwnerPhone = override?.potential_owner_phone || '';
        const contact_confidence =
          licensedContactName || licensedPhone || potentialOwnerName || potentialOwnerPhone
            ? 'Verified'
            : permit.applicant_license
              ? 'License Only'
              : 'Unresolved';

        return {
          ...permit,
          jobFilingNumber: (permit as any).jobFilingNumber || permit.id,
          owner_name: override?.owner_name || permit.owner_name,
          owner_business_name: override?.owner_business_name || permit.owner_business_name,
          applicant_business_name: override?.applicant_business_name || (permit as any).applicant_business_name,
          contact_name: licensedContactName,
          phone: licensedPhone,
          licensed_business_name: lookup?.business_name || '',
          licensed_contact_name: licensedContactName,
          licensed_phone: licensedPhone,
          license_status: lookup?.license_status || '',
          license_type: lookup?.license_type || '',
          potential_owner_name: potentialOwnerName,
          potential_owner_phone: potentialOwnerPhone,
          owner_path_source: override?.owner_path_source || '',
          contact_confidence,
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
    applicant_business_name: 'Real Estate Management',
    estimated_job_costs: Math.round(Math.random() * 500000),
    licensed_business_name: '',
    licensed_contact_name: '',
    licensed_phone: '',
    license_status: '',
    license_type: '',
    potential_owner_name: '',
    potential_owner_phone: '',
    owner_path_source: '',
    contact_confidence: 'Unresolved',
    source: 'Mock DOB filing data',
  }));
}
