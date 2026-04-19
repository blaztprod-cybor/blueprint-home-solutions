import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const permitsPath = path.join(root, 'public/data/permits.json');
const candidatePath = path.join(root, 'public/data/filing-contact-candidates.json');
const crosswalkPath = path.join(root, 'public/data/filing-contact-crosswalk.json');

function normalizeLicenseKey(value) {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const stripped = digitsOnly.replace(/^0+/, '');
  return stripped || digitsOnly || '';
}

function normalizeText(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(LLC|L\.L\.C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|L P|LLP|L L P|PLLC|P C|PC)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(value, houseNumber, streetName) {
  const raw = value || [houseNumber, streetName].filter(Boolean).join(' ');
  return normalizeText(raw);
}

function normalizeZip(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 5);
}

function classifyEntity(permit) {
  const businessName = normalizeText(permit.owner_business_name || permit.applicant_business_name || permit.owner_name);
  const licenseType = normalizeText(permit.license_type);

  if (
    businessName.includes('CITY OF NEW YORK') ||
    businessName.includes('DEPARTMENT OF') ||
    businessName.includes('NYC PARKS') ||
    businessName.includes('NYCHA')
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

  if (businessName.includes('EXPEDIT')) {
    return 'Expediter';
  }

  if (
    businessName.includes('DEVELOP') ||
    businessName.includes('HOLDINGS') ||
    businessName.includes('PROPERTIES') ||
    businessName.includes('REALTY')
  ) {
    return 'Developer / Owner';
  }

  if (permit.applicant_license) {
    return 'Contractor';
  }

  return businessName ? 'Business / Organization' : 'Unknown';
}

function deriveLeadPath(entityType) {
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

function scoreCandidate(permit, candidate) {
  const permitBusiness = normalizeText(permit.owner_business_name || permit.applicant_business_name || permit.owner_name);
  const permitAddress = normalizeAddress(permit.address, permit.house_number, permit.street_name);
  const permitBorough = normalizeText(permit.borough);
  const permitZip = normalizeZip(permit.zip_code);

  const candidateBusiness = normalizeText(candidate.business_name);
  const candidateAddress = normalizeText(candidate.address);
  const candidateBorough = normalizeText(candidate.borough);
  const candidateZip = normalizeZip(candidate.zip_code || candidate.address);

  let score = 0;
  const matchedOn = [];

  if (permitBusiness && candidateBusiness && permitBusiness === candidateBusiness) {
    score += 60;
    matchedOn.push('business_name');
  }

  if (permitAddress && candidateAddress && permitAddress === candidateAddress) {
    score += 25;
    matchedOn.push('address');
  }

  if (permitBorough && candidateBorough && permitBorough === candidateBorough) {
    score += 10;
    matchedOn.push('borough');
  }

  if (permitZip && candidateZip && permitZip === candidateZip) {
    score += 10;
    matchedOn.push('zip_code');
  }

  if (candidate.phone) {
    score += 5;
    matchedOn.push('phone_present');
  }

  return { score, matchedOn };
}

function confidenceFromScore(score) {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  if (score >= 40) return 'Low';
  return 'Unresolved';
}

function toCrosswalkRecord(permit, candidate, score, matchedOn) {
  const entityType = classifyEntity(permit);
  return {
    id: `${normalizeText(candidate.business_name || permit.owner_business_name || permit.owner_name).toLowerCase().replace(/\s+/g, '-') || 'crosswalk'}-${normalizeLicenseKey(permit.applicant_license) || 'nolicense'}`,
    applicant_license: permit.applicant_license || '',
    normalized_applicant_name: normalizeText(permit.contact_name || permit.owner_name),
    normalized_business_name: normalizeText(candidate.business_name || permit.owner_business_name || permit.applicant_business_name || permit.owner_name),
    normalized_address: normalizeAddress(permit.address, permit.house_number, permit.street_name),
    borough: permit.borough || '',
    zip_code: permit.zip_code || '',
    entity_type: entityType,
    lead_path: deriveLeadPath(entityType),
    contact_name: candidate.contact_name || '',
    business_name: candidate.business_name || permit.owner_business_name || permit.applicant_business_name || permit.owner_name,
    phone: String(candidate.phone || '').trim(),
    email: String(candidate.email || '').trim(),
    address: candidate.address || '',
    source_name: candidate.source_name || 'Candidate source',
    source_type: candidate.source_type || 'Unknown',
    source_record_id: candidate.source_record_id || '',
    status: candidate.status || 'candidate',
    confidence: confidenceFromScore(score),
    match_score: score,
    matched_on: matchedOn,
    last_verified_at: candidate.last_verified_at || '',
    notes: candidate.notes || '',
  };
}

const loadJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const saveJson = async (filePath, value) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const main = async () => {
  const permitPayload = await loadJson(permitsPath);
  const candidatePayload = await loadJson(candidatePath);
  const crosswalkPayload = await loadJson(crosswalkPath);

  const permits = Array.isArray(permitPayload) ? permitPayload : permitPayload.permits || permitPayload.records || [];
  const candidates = Array.isArray(candidatePayload) ? candidatePayload : candidatePayload.records || [];
  const existing = Array.isArray(crosswalkPayload) ? crosswalkPayload : crosswalkPayload.records || [];

  const nextRecords = [...existing];
  const existingIds = new Set(existing.map((record) => record.id));

  for (const candidate of candidates) {
    const matchingPermits = permits.filter((permit) => {
      const permitBusiness = normalizeText(permit.owner_business_name || permit.applicant_business_name || permit.owner_name);
      return permitBusiness && permitBusiness === normalizeText(candidate.business_name);
    });

    for (const permit of matchingPermits) {
      const { score, matchedOn } = scoreCandidate(permit, candidate);
      if (score < 40) continue;

      const record = toCrosswalkRecord(permit, candidate, score, matchedOn);
      if (existingIds.has(record.id)) continue;

      nextRecords.push(record);
      existingIds.add(record.id);
    }
  }

  const nextPayload = {
    version: 1,
    updated_at: new Date().toISOString(),
    records: nextRecords.sort((left, right) => {
      if ((left.status || '') !== (right.status || '')) {
        return left.status === 'verified' ? -1 : 1;
      }
      return (right.match_score || 0) - (left.match_score || 0);
    }),
  };

  await saveJson(crosswalkPath, nextPayload);
  console.log(`Wrote ${nextRecords.length} crosswalk records to ${crosswalkPath}`);
};

main().catch((error) => {
  console.error('Failed to build filing crosswalk', error);
  process.exit(1);
});
