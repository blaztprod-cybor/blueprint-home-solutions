import { DOBPermit } from '../types';
import {
  classifyPermitEntity,
  deriveLeadPath,
  loadFilingContactCrosswalk,
  resolvePermitCrosswalkMatch,
} from './filingCrosswalkService';

const NETLIFY_PERMIT_FEED = '/api/dob-permits';
const STATIC_PERMIT_FEED = '/data/permits.json';
const LICENSE_LOOKUP_FEED = '/data/license-lookup.json';
const VERIFIED_CONTACT_BOOK_FEED = '/data/verified-contact-book.json';
const CONTACT_OVERRIDE_FEED = '/data/permit-contact-overrides.json';
const BUSINESS_CONTACT_OVERRIDE_FEED = '/data/business-contact-overrides.json';

async function readJsonResponse(response: Response | null) {
  if (!response?.ok) return null;

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json().catch(() => null);
}

function normalizeLicenseKey(value: string | number | null | undefined): string {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const stripped = digitsOnly.replace(/^0+/, '');
  return stripped || digitsOnly || '';
}

function buildPermitOverrideKey(jobFilingNumber?: string, address?: string): string {
  return `${String(jobFilingNumber || '').trim().toUpperCase()}|${String(address || '').trim().toUpperCase()}`;
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(LLC|L\.L\.C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|L P|LLP|L L P|PLLC|P C|PC)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(value: string | undefined, houseNumber: string | undefined, streetName: string | undefined): string {
  const raw = value || [houseNumber, streetName].filter(Boolean).join(' ');
  return normalizeText(raw);
}

function normalizeZip(value: string | undefined): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(0, 5);
}

function normalizeBusinessName(permit: DOBPermit): string {
  return normalizeText(permit.owner_business_name || permit.applicant_business_name || permit.owner_name);
}

function normalizeBusinessNameValue(value: string | undefined): string {
  return normalizeText(value);
}

function getJobRootIdentifier(permit: DOBPermit): string {
  const jobId = String((permit as any).jobFilingNumber || permit.id || '').trim().toUpperCase();
  const match = jobId.match(/^([A-Z]\d+)/);
  return match?.[1] || jobId;
}

export function isPublicAgencyPermit(permit: DOBPermit): boolean {
  const businessName = normalizeBusinessName(permit);
  return (
    businessName.includes('NYC PARKS') ||
    businessName.includes('NEW YORK CITY PARKS') ||
    businessName.includes('NEW YORK CITY HOUSING AUTHORITY') ||
    businessName.includes('NYCHA') ||
    businessName.includes('DEPARTMENT OF TRANSPORTATION') ||
    businessName.includes('DEPARTMENT OF EDUCATION') ||
    businessName.includes('SCHOOL CONSTRUCTION AUTHORITY') ||
    businessName.includes('CITY OF NEW YORK')
  );
}

function scorePermitCompleteness(permit: DOBPermit): number {
  let score = 0;
  if (permit.licensed_contact_name) score += 4;
  if (permit.licensed_phone) score += 4;
  if (permit.potential_owner_name) score += 2;
  if (permit.potential_owner_phone) score += 2;
  if (permit.owner_business_name || permit.applicant_business_name) score += 2;
  if (permit.zip_code) score += 1;
  if (permit.job_description && permit.job_description !== 'No description provided') score += 1;

  const filingTimestamp = new Date(String(permit.filing_date || '')).getTime();
  if (Number.isFinite(filingTimestamp)) {
    score += filingTimestamp / 1e13;
  }

  return score;
}

function buildDuplicateGroupKey(permit: DOBPermit): string {
  return [
    getJobRootIdentifier(permit),
    normalizeText(permit.borough),
    normalizeAddress(permit.address, permit.house_number, permit.street_name),
    normalizeText(permit.job_type),
    normalizeBusinessName(permit),
  ].join('|');
}

function collapseDuplicatePermits(permits: DOBPermit[]): DOBPermit[] {
  const groupedPermits = new Map<string, DOBPermit[]>();

  permits.forEach((permit) => {
    const groupKey = buildDuplicateGroupKey(permit);
    const group = groupedPermits.get(groupKey);

    if (group) {
      group.push(permit);
    } else {
      groupedPermits.set(groupKey, [permit]);
    }
  });

  return Array.from(groupedPermits.entries()).map(([groupKey, group]) => {
    const sortedGroup = [...group].sort((left, right) => scorePermitCompleteness(right) - scorePermitCompleteness(left));
    const primaryPermit = sortedGroup[0];
    const zipCodes = Array.from(new Set(group.map((permit) => normalizeZip(permit.zip_code)).filter(Boolean)));
    const hasZipConflict = zipCodes.length > 1;
    const businessName = sortedGroup.find((permit) => permit.owner_business_name || permit.applicant_business_name);
    const publicAgency = sortedGroup.some((permit) => isPublicAgencyPermit(permit));
    const contactConfidence =
      hasZipConflict
        ? 'Conflict'
        : publicAgency
          ? 'Public Agency'
        : primaryPermit.licensed_contact_name || primaryPermit.licensed_phone || primaryPermit.potential_owner_name || primaryPermit.potential_owner_phone
          ? 'Verified'
          : businessName?.owner_business_name || businessName?.applicant_business_name
            ? 'Business Only'
            : primaryPermit.applicant_license
              ? 'License Only'
              : 'Unresolved';

    return {
      ...primaryPermit,
      owner_business_name: businessName?.owner_business_name || primaryPermit.owner_business_name,
      applicant_business_name: businessName?.applicant_business_name || primaryPermit.applicant_business_name,
      zip_code: primaryPermit.zip_code || zipCodes[0] || '',
      contact_confidence: contactConfidence,
      related_filing_count: group.length,
      zip_conflict: hasZipConflict,
      alternate_zip_codes: hasZipConflict ? zipCodes : [],
      duplicate_group_key: groupKey,
    };
  });
}

function getLatestPermitTimestamp(permits: DOBPermit[]): number {
  return permits.reduce((latest, permit) => {
    const timestamp = new Date(String(permit.filing_date || '')).getTime();
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

function choosePreferredPermitFeed(primary: DOBPermit[], secondary: DOBPermit[]): DOBPermit[] {
  const primaryLatest = getLatestPermitTimestamp(primary);
  const secondaryLatest = getLatestPermitTimestamp(secondary);

  if (secondaryLatest > primaryLatest) {
    return secondary;
  }

  if (primaryLatest > secondaryLatest) {
    return primary;
  }

  return secondary.length > primary.length ? secondary : primary;
}

export async function fetchDOBPermits(limit = 20): Promise<DOBPermit[]> {
  try {
    const [
      licenseLookupResponse,
      verifiedContactBookResponse,
      contactOverrideResponse,
      businessContactOverrideResponse,
      crosswalkRecords,
    ] = await Promise.all([
      fetch(LICENSE_LOOKUP_FEED, { cache: 'no-store' }).catch(() => null),
      fetch(VERIFIED_CONTACT_BOOK_FEED, { cache: 'no-store' }).catch(() => null),
      fetch(CONTACT_OVERRIDE_FEED, { cache: 'no-store' }).catch(() => null),
      fetch(BUSINESS_CONTACT_OVERRIDE_FEED, { cache: 'no-store' }).catch(() => null),
      loadFilingContactCrosswalk().catch(() => []),
    ]);
    let licenseLookup = new Map<string, { contact_name?: string; phone?: string; business_name?: string; license_status?: string; license_type?: string }>();
    let contactOverrides = new Map<string, Partial<DOBPermit>>();
    let businessContactOverrides = new Map<string, { phone?: string; source?: string; address?: string }[]>();

    const mergeLookupRecords = (records: any[]) => {
      records
        .filter((record: any) => normalizeLicenseKey(record.license_number))
        .forEach((record: any) => {
          const key = normalizeLicenseKey(record.license_number);
          const existing = licenseLookup.get(key) || {};

          licenseLookup.set(key, {
            contact_name: existing.contact_name || record.contact_name || '',
            phone: existing.phone || record.phone || '',
            business_name: existing.business_name || record.business_name || '',
            license_status: existing.license_status || record.license_status || '',
            license_type: existing.license_type || record.license_type || '',
          });
        });
    };

    if (licenseLookupResponse?.ok) {
      const lookupPayload = await licenseLookupResponse.json();
      const records = Array.isArray(lookupPayload) ? lookupPayload : lookupPayload.records;
      if (Array.isArray(records)) {
        mergeLookupRecords(records);
      }
    }

    if (verifiedContactBookResponse?.ok) {
      const verifiedPayload = await verifiedContactBookResponse.json();
      const records = Array.isArray(verifiedPayload) ? verifiedPayload : verifiedPayload.records;

      if (Array.isArray(records)) {
        mergeLookupRecords(records);
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

    if (businessContactOverrideResponse?.ok) {
      const businessOverridePayload = await businessContactOverrideResponse.json();
      const businessOverrideRecords = Array.isArray(businessOverridePayload)
        ? businessOverridePayload
        : businessOverridePayload.records;

      if (Array.isArray(businessOverrideRecords)) {
        businessContactOverrides = businessOverrideRecords.reduce(
          (accumulator: Map<string, { phone?: string; source?: string; address?: string }[]>, record: any) => {
            const key = normalizeBusinessNameValue(record.business_name);
            if (!key) return accumulator;

            const existing = accumulator.get(key) || [];
            existing.push({
              phone: String(record.phone || '').trim(),
              source: String(record.source || '').trim(),
              address: String(record.address || '').trim(),
            });
            accumulator.set(key, existing);
            return accumulator;
          },
          new Map()
        );
      }
    }

    const findBusinessPhoneOverride = (permit: DOBPermit) => {
      const candidates = [
        permit.owner_business_name,
        permit.applicant_business_name,
        permit.owner_name,
      ]
        .map((value) => normalizeBusinessNameValue(value))
        .filter(Boolean);

      const normalizedAddress = String(permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' ')).trim().toUpperCase();

      for (const candidate of candidates) {
        const records = businessContactOverrides.get(candidate) || [];
        const addressMatch = records.find((record) => String(record.address || '').trim().toUpperCase() === normalizedAddress);
        if (addressMatch?.phone) return addressMatch;

        const anyMatch = records.find((record) => record.phone);
        if (anyMatch?.phone) return anyMatch;
      }

      return null;
    };

    const enrichPermits = (permits: DOBPermit[]) =>
      collapseDuplicatePermits(permits.map((permit) => {
        const override =
          contactOverrides.get(buildPermitOverrideKey((permit as any).jobFilingNumber, permit.address)) ||
          contactOverrides.get(buildPermitOverrideKey((permit as any).jobFilingNumber, [permit.house_number, permit.street_name].filter(Boolean).join(' ')));
        const lookup = licenseLookup.get(normalizeLicenseKey(permit.applicant_license));
        const entityType = classifyPermitEntity(permit);
        const crosswalkMatch = resolvePermitCrosswalkMatch(permit, crosswalkRecords);
        const licensedContactName = lookup?.contact_name || '';
        const licensedPhone = lookup?.phone || '';
        const potentialOwnerName = override?.potential_owner_name || '';
        const potentialOwnerPhone = override?.potential_owner_phone || '';
        const businessPhoneOverride = findBusinessPhoneOverride({
          ...permit,
          owner_business_name: override?.owner_business_name || permit.owner_business_name,
          applicant_business_name: override?.applicant_business_name || (permit as any).applicant_business_name,
          owner_name: override?.owner_name || permit.owner_name,
        } as DOBPermit);
        return {
          ...permit,
          jobFilingNumber: (permit as any).jobFilingNumber || permit.id,
          owner_name: override?.owner_name || permit.owner_name,
          owner_business_name: override?.owner_business_name || permit.owner_business_name,
          applicant_business_name: override?.applicant_business_name || (permit as any).applicant_business_name,
          contact_name: crosswalkMatch?.contact_name || licensedContactName,
          phone: crosswalkMatch?.phone || licensedPhone,
          licensed_business_name: crosswalkMatch?.business_name || lookup?.business_name || '',
          licensed_contact_name: crosswalkMatch?.contact_name || licensedContactName,
          licensed_phone: crosswalkMatch?.phone || licensedPhone,
          license_status: lookup?.license_status || '',
          license_type: lookup?.license_type || '',
          potential_owner_name: potentialOwnerName,
          potential_owner_phone: potentialOwnerPhone,
          business_phone: crosswalkMatch?.phone || businessPhoneOverride?.phone || '',
          business_phone_source: crosswalkMatch?.source_name || businessPhoneOverride?.source || '',
          owner_path_source: override?.owner_path_source || '',
          entity_type: crosswalkMatch?.entity_type || entityType,
          lead_path: crosswalkMatch?.lead_path || deriveLeadPath(entityType),
          crosswalk_confidence: crosswalkMatch?.confidence || 'Unresolved',
          crosswalk_source_type: crosswalkMatch?.source_type || 'Unknown',
          crosswalk_last_verified_at: crosswalkMatch?.last_verified_at || '',
          contact_confidence:
            crosswalkMatch?.phone || crosswalkMatch?.contact_name || licensedContactName || licensedPhone || potentialOwnerName || potentialOwnerPhone
              ? 'Verified'
            : isPublicAgencyPermit(permit)
                ? 'Public Agency'
              : permit.owner_business_name || (permit as any).applicant_business_name || override?.owner_business_name || override?.applicant_business_name
                ? 'Business Only'
                : permit.applicant_license
                  ? 'License Only'
                  : 'Unresolved',
        };
      }));

    const [liveResponse, staticResponse] = await Promise.all([
      fetch(`${NETLIFY_PERMIT_FEED}?limit=${limit}`, { cache: 'no-store' }).catch(() => null),
      fetch(STATIC_PERMIT_FEED, { cache: 'no-store' }).catch(() => null),
    ]);

    const livePayload = await readJsonResponse(liveResponse);
    const livePermits = Array.isArray(livePayload) ? livePayload : livePayload?.permits;
    const enrichedLivePermits = Array.isArray(livePermits) ? enrichPermits(livePermits) : [];

    const staticPayload = await readJsonResponse(staticResponse);
    const staticPermits = Array.isArray(staticPayload) ? staticPayload : staticPayload?.permits;
    const enrichedStaticPermits = Array.isArray(staticPermits) ? enrichPermits(staticPermits).slice(0, limit) : [];

    if (enrichedLivePermits.length > 0) {
      return choosePreferredPermitFeed(enrichedLivePermits, enrichedStaticPermits);
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
    business_phone: '',
    business_phone_source: '',
    owner_path_source: '',
    contact_confidence: 'Unresolved',
    source: 'Mock DOB filing data',
  }));
}
