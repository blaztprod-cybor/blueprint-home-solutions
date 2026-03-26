import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'data');
const outputFile = path.join(outputDir, 'permits.json');

const BOROUGHS = [
  'QUEENS',
  'BROOKLYN',
  'MANHATTAN',
  'BRONX',
  'STATEN ISLAND',
];

const DEFAULT_LIMIT = Number(process.env.DOB_LIMIT || 1000);
const BASE_URL = 'https://data.cityofnewyork.us/resource/rbx6-tga4.json';

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

const DEFAULT_START_DATE = process.env.DOB_START_DATE || getBusinessDaysBackDate(10);

function buildUrl(borough) {
  const params = new URLSearchParams({
    '$where': `borough='${borough}' AND issued_date >= '${DEFAULT_START_DATE}'`,
    '$order': 'issued_date DESC',
    '$limit': String(DEFAULT_LIMIT),
  });

  return `${BASE_URL}?${params.toString()}`;
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

function normalizePermit(row) {
  return {
    id: row.job_filing_number || row.work_permit || randomUUID(),
    jobFilingNumber: row.job_filing_number || '',
    workPermit: row.work_permit || '',
    sequenceNumber: row.sequence_number || '',
    filingReason: row.filing_reason || '',
    borough: row.borough || 'N/A',
    house_number: row.house_no || '',
    street_name: row.street_name || '',
    address: [row.house_no, row.street_name].filter(Boolean).join(' '),
    job_type: row.work_type || 'N/A',
    permit_status: row.permit_status || 'N/A',
    filing_date: normalizeDate(row.approved_date),
    issuance_date: normalizeDate(row.issued_date),
    expiration_date: normalizeDate(row.expired_date),
    job_description: row.job_description || 'No description provided',
    estimated_job_costs: Number(row.estimated_job_costs || 0),
    owner_name: row.owner_name || 'Private Owner',
    owner_business_name: row.applicant_business_name || row.owner_business_name || 'N/A',
    phone_number: '',
    zip_code: row.zip_code || '',
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    community_board: row.community_board || '',
    council_district: row.council_district || '',
    bbl: row.bbl || '',
    census_tract: row.census_tract || '',
    nta: row.nta || '',
    source: 'NYC DOB NOW Build Approved Permits',
  };
}

async function fetchBoroughPermits(borough) {
  const url = buildUrl(borough);
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DOB fetch failed for ${borough}: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.map(normalizePermit);
}

async function main() {
  const boroughResults = await Promise.all(BOROUGHS.map(fetchBoroughPermits));
  const permits = boroughResults
    .flat()
    .sort((a, b) => new Date(b.issuance_date).getTime() - new Date(a.issuance_date).getTime());

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'NYC DOB NOW Build Approved Permits',
    startDate: DEFAULT_START_DATE,
    boroughs: BOROUGHS,
    count: permits.length,
    permits,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${permits.length} permits to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
