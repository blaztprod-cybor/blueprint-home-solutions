import {
  CrosswalkConfidence,
  DOBPermit,
  FilingContactCrosswalkRecord,
  FilingEntityType,
  FilingLeadPath,
} from '../types';

const CROSSWALK_FEED = '/data/filing-contact-crosswalk.json';

function normalizeLicenseKey(value: string | number | null | undefined): string {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const stripped = digitsOnly.replace(/^0+/, '');
  return stripped || digitsOnly || '';
}

export function normalizeCrosswalkText(value: string | null | undefined): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(LLC|L\.L\.C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|L P|LLP|L L P|PLLC|P C|PC)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(value: string | undefined, houseNumber: string | undefined, streetName: string | undefined): string {
  const raw = value || [houseNumber, streetName].filter(Boolean).join(' ');
  return normalizeCrosswalkText(raw);
}

function normalizeZip(value: string | undefined): string {
  return String(value || '').replace(/\D/g, '').slice(0, 5);
}

function scoreCrosswalkRecord(record: FilingContactCrosswalkRecord): number {
  const confidenceWeight: Record<CrosswalkConfidence, number> = {
    High: 300,
    Medium: 200,
    Low: 100,
    Unresolved: 0,
  };

  return (
    (record.status === 'verified' ? 500 : record.status === 'candidate' ? 100 : -1000) +
    (confidenceWeight[record.confidence] || 0) +
    (record.phone ? 20 : 0) +
    (record.contact_name ? 10 : 0) +
    (record.last_verified_at ? Date.parse(record.last_verified_at) / 1e11 : 0)
  );
}

export function classifyPermitEntity(permit: DOBPermit): FilingEntityType {
  const businessName = normalizeCrosswalkText(permit.owner_business_name || permit.applicant_business_name || permit.owner_name);
  const applicantName = normalizeCrosswalkText(permit.contact_name || permit.licensed_contact_name || permit.owner_name);
  const licenseType = normalizeCrosswalkText(permit.license_type);

  if (
    businessName.includes('CITY OF NEW YORK') ||
    businessName.includes('DEPARTMENT OF') ||
    businessName.includes('NYC PARKS') ||
    businessName.includes('NYCHA') ||
    businessName.includes('SCHOOL CONSTRUCTION AUTHORITY')
  ) {
    return 'Public Agency';
  }

  if (
    licenseType.includes('ARCHITECT') ||
    licenseType.includes('ENGINEER') ||
    businessName.includes('ARCHITECT') ||
    businessName.includes('ENGINEER')
  ) {
    return 'Architect / Engineer';
  }

  if (businessName.includes('EXPEDIT') || applicantName.includes('EXPEDIT')) {
    return 'Expediter';
  }

  if (
    businessName.includes('DEVELOP') ||
    businessName.includes('HOLDINGS') ||
    businessName.includes('PROPERTIES') ||
    businessName.includes('REALTY') ||
    businessName.includes('OWNER')
  ) {
    return 'Developer / Owner';
  }

  if (permit.applicant_license || licenseType.includes('CONTRACTOR')) {
    return 'Contractor';
  }

  if (businessName) {
    return 'Business / Organization';
  }

  return 'Unknown';
}

export function deriveLeadPath(entityType: FilingEntityType): FilingLeadPath {
  switch (entityType) {
    case 'Contractor':
      return 'Direct';
    case 'Architect / Engineer':
    case 'Expediter':
    case 'Developer / Owner':
    case 'Business / Organization':
      return 'Indirect';
    case 'Public Agency':
      return 'Procurement';
    default:
      return 'Unknown';
  }
}

export async function loadFilingContactCrosswalk(): Promise<FilingContactCrosswalkRecord[]> {
  const response = await fetch(CROSSWALK_FEED, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const records = Array.isArray(payload) ? payload : payload.records;
  return Array.isArray(records) ? records : [];
}

export function resolvePermitCrosswalkMatch(
  permit: DOBPermit,
  records: FilingContactCrosswalkRecord[]
): FilingContactCrosswalkRecord | null {
  const licenseKey = normalizeLicenseKey(permit.applicant_license);
  const normalizedBusinessName = normalizeCrosswalkText(
    permit.owner_business_name || permit.applicant_business_name || permit.owner_name
  );
  const normalizedApplicantName = normalizeCrosswalkText(
    permit.contact_name || permit.licensed_contact_name || permit.owner_name
  );
  const normalizedAddress = normalizeAddress(permit.address, permit.house_number, permit.street_name);
  const normalizedBorough = normalizeCrosswalkText(permit.borough);
  const zipCode = normalizeZip(permit.zip_code);

  const scoredCandidates = records
    .filter((record) => record.status !== 'rejected')
    .map((record) => {
      let score = scoreCrosswalkRecord(record);

      if (licenseKey && normalizeLicenseKey(record.applicant_license) === licenseKey) score += 1000;
      if (normalizedBusinessName && normalizeCrosswalkText(record.normalized_business_name || record.business_name) === normalizedBusinessName) score += 300;
      if (normalizedApplicantName && normalizeCrosswalkText(record.normalized_applicant_name || record.contact_name) === normalizedApplicantName) score += 200;
      if (normalizedAddress && normalizeCrosswalkText(record.normalized_address || record.address) === normalizedAddress) score += 200;
      if (normalizedBorough && normalizeCrosswalkText(record.borough) === normalizedBorough) score += 50;
      if (zipCode && normalizeZip(record.zip_code) === zipCode) score += 50;

      return { record, score };
    })
    .filter(({ score }) => score >= 300)
    .sort((left, right) => right.score - left.score);

  const best = scoredCandidates[0]?.record || null;
  if (!best) return null;

  // Candidate records help research and future automation, but Filing Leads
  // should only auto-fill from verified matches.
  return best.status === 'verified' ? best : null;
}
