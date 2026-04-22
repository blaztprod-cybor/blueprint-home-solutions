import { ElevatorIntelligenceSourceStatus, ElevatorOpportunity, ElevatorOpportunityTier } from '../types';

const SOCRATA_BASE = 'https://data.cityofnewyork.us/resource';

const SOURCE_URLS = {
  permits: 'https://data.cityofnewyork.us/d/kfp4-dz4h',
  devices: 'https://data.cityofnewyork.us/d/juyv-2jek',
  violations: 'https://data.cityofnewyork.us/d/8qed-xr5q',
  hpd: 'https://data.cityofnewyork.us/d/tesw-yqqr',
  co: 'https://data.cityofnewyork.us/d/9r28-dr8b',
  acrisMaster: 'https://data.cityofnewyork.us/d/bnx9-e6tj',
  acrisLegals: 'https://data.cityofnewyork.us/d/8h5j-fqxa',
  acrisParties: 'https://data.cityofnewyork.us/d/636b-3b5g',
} as const;

type ElevatorPermitRow = {
  job_filing_number?: string;
  filing_date?: string;
  filingstatus_or_filingincludes?: string;
  filing_status?: string;
  house_number?: string;
  street_name?: string;
  borough?: string;
  zip?: string;
  bbl?: string;
  building_type?: string;
  applicant_businessname?: string;
  owner_businessname?: string;
  descriptionofwork?: string;
  estimated_cost?: string;
};

type ElevatorDeviceRow = {
  job_filing_number?: string;
  device_id?: string;
  device_type?: string;
  device_status?: string;
  elevator_type?: string;
  physical_address?: string;
};

type ViolationRow = {
  ecb_violation_number?: string;
  issue_date?: string;
  severity?: string;
  violation_type?: string;
  respondent_name?: string;
};

type HpdRegistrationRow = {
  boro?: string;
  housenumber?: string;
  streetname?: string;
  zip?: string;
  block?: string;
  lot?: string;
  bin?: string;
  lastregistrationdate?: string;
  registrationenddate?: string;
};

type CertificateOfOccupancyRow = {
  bbl?: string;
  borough?: string;
  house_number?: string;
  street_name?: string;
  postcode?: string;
  c_o_issue_date?: string;
  issue_type?: string;
  application_status_raw?: string;
  filing_status_raw?: string;
};

type AcrisMasterRow = {
  document_id?: string;
  doc_type?: string;
  document_date?: string;
  document_amt?: string;
  recorded_datetime?: string;
  recorded_borough?: string;
};

type AcrisLegalRow = {
  document_id?: string;
  borough?: string;
  block?: string;
  lot?: string;
  street_number?: string;
  street_name?: string;
  unit?: string;
};

type AcrisPartyRow = {
  document_id?: string;
  party_type?: string;
  name?: string;
};

type Complaint311Row = {
  unique_key?: string;
  created_date?: string;
  descriptor?: string;
  incident_address?: string;
  borough?: string;
  incident_zip?: string;
  bbl?: string;
  status?: string;
};

export interface ElevatorIntelligencePayload {
  sources: ElevatorIntelligenceSourceStatus[];
  opportunities: ElevatorOpportunity[];
  updatedAt: string;
}

async function fetchRows<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SOCRATA_BASE}/${path}.json`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return (await response.json()) as T[];
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigits(value?: string | null) {
  return String(value || '').replace(/\D+/g, '');
}

function toBoroughCode(value?: string | null) {
  const normalized = normalizeText(value);

  if (normalized === 'MANHATTAN' || normalized === '1') return '1';
  if (normalized === 'BRONX' || normalized === '2') return '2';
  if (normalized === 'BROOKLYN' || normalized === '3') return '3';
  if (normalized === 'QUEENS' || normalized === '4') return '4';
  if (normalized === 'STATEN ISLAND' || normalized === '5') return '5';

  return '';
}

function buildBblKey(borough?: string | null, block?: string | null, lot?: string | null) {
  const boroughCode = toBoroughCode(borough);
  const blockDigits = normalizeDigits(block);
  const lotDigits = normalizeDigits(lot);

  if (!boroughCode || !blockDigits || !lotDigits) {
    return '';
  }

  return `${boroughCode}${blockDigits.padStart(5, '0')}${lotDigits.padStart(4, '0')}`;
}

function normalizeAddress(house?: string | null, street?: string | null) {
  return [normalizeText(house), normalizeText(street)].filter(Boolean).join(' ');
}

function normalizeLooseAddress(value?: string | null) {
  return normalizeText(value)
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value?: string | number | null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunkIds(ids: string[], size = 40) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

function buildInClause(ids: string[]) {
  return ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
}

function buildAddressInWhere(field: string, values: string[]) {
  return `${field} in(${buildInClause(values)})`;
}

function parseBblParts(bbl?: string | null) {
  const digits = normalizeDigits(bbl);
  if (digits.length !== 10) return null;

  return {
    borough: digits.slice(0, 1),
    block: String(Number(digits.slice(1, 6))),
    lot: String(Number(digits.slice(6, 10))),
  };
}

function buildBblTripletWhere(values: string[], fieldNames: { borough: string; block: string; lot: string }) {
  const clauses = values
    .map((value) => parseBblParts(value))
    .filter((value): value is NonNullable<ReturnType<typeof parseBblParts>> => !!value)
    .map(
      (value) =>
        `(${fieldNames.borough}='${value.borough}' and ${fieldNames.block}='${value.block}' and ${fieldNames.lot}='${value.lot}')`,
    );

  return clauses.join(' or ');
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function computeTier(score: number): ElevatorOpportunityTier {
  if (score >= 75) return 'High';
  if (score >= 45) return 'Medium';
  return 'Watch';
}

function recommendedActionForTier(tier: ElevatorOpportunityTier) {
  if (tier === 'High') return 'Call owner or manager now and qualify modernization timing.';
  if (tier === 'Medium') return 'Research the building and queue targeted outreach this week.';
  return 'Save and monitor for additional permit, device, or ownership movement.';
}

export async function fetchElevatorIntelligence(): Promise<ElevatorIntelligencePayload> {
  const [
    permits,
    devices,
    violations,
    hpdRegistrations,
    certificatesOfOccupancy,
    recentDeeds,
  ] = await Promise.all([
    fetchRows<ElevatorPermitRow>('kfp4-dz4h', {
      $select:
        'job_filing_number,filing_date,filingstatus_or_filingincludes,filing_status,house_number,street_name,borough,zip,bbl,building_type,applicant_businessname,owner_businessname,descriptionofwork,estimated_cost',
      $order: 'filing_date DESC',
      $limit: '120',
    }),
    fetchRows<ElevatorDeviceRow>('juyv-2jek', {
      $select: 'job_filing_number,device_id,device_type,device_status,elevator_type,physical_address',
      $where: "device_status is not null",
      $limit: '250',
    }),
    fetchRows<ViolationRow>('8qed-xr5q', {
      $select: 'ecb_violation_number,issue_date,severity,violation_type,respondent_name',
      $order: 'issue_date DESC',
      $limit: '120',
    }),
    fetchRows<HpdRegistrationRow>('tesw-yqqr', {
      $select: 'boro,housenumber,streetname,zip,block,lot,bin,lastregistrationdate,registrationenddate',
      $order: 'lastregistrationdate DESC',
      $limit: '400',
    }),
    fetchRows<CertificateOfOccupancyRow>('9r28-dr8b', {
      $select:
        'bbl,borough,house_number,street_name,postcode,c_o_issue_date,issue_type,application_status_raw,filing_status_raw',
      $order: 'c_o_issue_date DESC',
      $limit: '300',
    }),
    fetchRows<AcrisMasterRow>('bnx9-e6tj', {
      $select: 'document_id,doc_type,document_date,document_amt,recorded_datetime,recorded_borough',
      $where: "doc_type = 'DEED'",
      $order: 'recorded_datetime DESC',
      $limit: '150',
    }),
  ]);

  const deedIds = recentDeeds.map((row) => String(row.document_id || '').trim()).filter(Boolean);
  const deedChunks = chunkIds(deedIds);

  const [acrisLegals, acrisParties] = await Promise.all([
    Promise.all(
      deedChunks.map((chunk) =>
        fetchRows<AcrisLegalRow>('8h5j-fqxa', {
          $select: 'document_id,borough,block,lot,street_number,street_name,unit',
          $where: `document_id in(${buildInClause(chunk)})`,
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
    Promise.all(
      deedChunks.map((chunk) =>
        fetchRows<AcrisPartyRow>('636b-3b5g', {
          $select: 'document_id,party_type,name',
          $where: `document_id in(${buildInClause(chunk)})`,
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
  ]);

  const deviceByJob = new Map<string, ElevatorDeviceRow>();
  const deviceCountByAddress = new Map<string, number>();
  devices.forEach((device) => {
    const jobKey = normalizeText(device.job_filing_number);
    const addressKey = normalizeLooseAddress(device.physical_address);

    if (jobKey && !deviceByJob.has(jobKey)) {
      deviceByJob.set(jobKey, device);
    }

    if (addressKey) {
      deviceCountByAddress.set(addressKey, (deviceCountByAddress.get(addressKey) || 0) + 1);
    }
  });

  const hpdByBbl = new Map<string, HpdRegistrationRow>();
  hpdRegistrations.forEach((record) => {
    const bblKey = buildBblKey(record.boro, record.block, record.lot);
    if (bblKey && !hpdByBbl.has(bblKey)) {
      hpdByBbl.set(bblKey, record);
    }
  });

  const coByBbl = new Map<string, CertificateOfOccupancyRow>();
  certificatesOfOccupancy.forEach((record) => {
    const bblKey = normalizeDigits(record.bbl);
    if (bblKey && !coByBbl.has(bblKey)) {
      coByBbl.set(bblKey, record);
    }
  });

  const acrisMasterByDocumentId = new Map<string, AcrisMasterRow>();
  recentDeeds.forEach((record) => {
    const documentId = String(record.document_id || '').trim();
    if (documentId) {
      acrisMasterByDocumentId.set(documentId, record);
    }
  });

  const acrisPartyByDocumentId = new Map<string, AcrisPartyRow[]>();
  acrisParties.forEach((record) => {
    const documentId = String(record.document_id || '').trim();
    if (!documentId) return;
    const existing = acrisPartyByDocumentId.get(documentId) || [];
    existing.push(record);
    acrisPartyByDocumentId.set(documentId, existing);
  });

  const recentSaleByBbl = new Map<
    string,
    {
      documentDate?: string;
      amount?: number;
      partyName?: string;
    }
  >();

  acrisLegals.forEach((record) => {
    const documentId = String(record.document_id || '').trim();
    const bblKey = buildBblKey(record.borough, record.block, record.lot);
    if (!documentId || !bblKey || recentSaleByBbl.has(bblKey)) {
      return;
    }

    const deed = acrisMasterByDocumentId.get(documentId);
    const parties = acrisPartyByDocumentId.get(documentId) || [];
    const namedParty = parties.find((party) => normalizeText(party.name));

    recentSaleByBbl.set(bblKey, {
      documentDate: deed?.document_date || deed?.recorded_datetime,
      amount: toNumber(deed?.document_amt),
      partyName: namedParty?.name,
    });
  });

  const opportunities: ElevatorOpportunity[] = permits
    .map((permit) => {
      const jobKey = normalizeText(permit.job_filing_number);
      const addressKey = normalizeAddress(permit.house_number, permit.street_name);
      const deviceMatch =
        (jobKey && deviceByJob.get(jobKey)) ||
        devices.find((device) => normalizeLooseAddress(device.physical_address) === addressKey);
      const bblKey = normalizeDigits(permit.bbl);
      const hpdMatch = hpdByBbl.get(bblKey);
      const coMatch = coByBbl.get(bblKey);
      const recentSale = recentSaleByBbl.get(bblKey);
      const estimatedCost = toNumber(permit.estimated_cost);
      const deviceCount = deviceCountByAddress.get(addressKey) || 0;
      const description = String(permit.descriptionofwork || '');
      const includes = String(permit.filingstatus_or_filingincludes || '');

      let score = 0;
      const signals: string[] = [];

      if (/MODERN/i.test(description)) {
        score += 35;
        signals.push('Modernization language in permit description');
      }

      if (/ALTERATION|REPLACEMENT/i.test(includes)) {
        score += 20;
        signals.push('Alteration or replacement filing path');
      }

      if (estimatedCost >= 200000) {
        score += 20;
        signals.push('Estimated cost at or above $200K');
      } else if (estimatedCost >= 75000) {
        score += 10;
        signals.push('Estimated cost above typical repair-level work');
      }

      if (normalizeText(deviceMatch?.device_status) === 'WORK IN PROGRESS') {
        score += 10;
        signals.push('Related device currently marked work in progress');
      }

      if (deviceCount > 1) {
        score += 10;
        signals.push('Multiple elevator devices tied to the same address');
      }

      if (recentSale?.documentDate) {
        const saleDate = new Date(recentSale.documentDate);
        const ageDays = Math.floor((Date.now() - saleDate.getTime()) / 86400000);

        if (!Number.isNaN(ageDays) && ageDays <= 365) {
          score += 15;
          signals.push('Recent deed activity within the last 12 months');
        }
      }

      if (hpdMatch?.lastregistrationdate) {
        score += 5;
        signals.push('Current HPD registration available');
      }

      const tier = computeTier(score);

      return {
        id: permit.job_filing_number || `${permit.bbl || addressKey}-${permit.filing_date || ''}`,
        jobFilingNumber: permit.job_filing_number || 'Unknown',
        address: `${permit.house_number || ''} ${permit.street_name || ''}`.trim(),
        borough: permit.borough || 'Unknown',
        zipCode: permit.zip,
        bbl: bblKey || undefined,
        ownerName: permit.owner_businessname || undefined,
        managementCompany: recentSale?.partyName || undefined,
        applicantBusinessName: permit.applicant_businessname || undefined,
        buildingType: permit.building_type || undefined,
        estimatedCost: estimatedCost || undefined,
        filingDate: formatDate(permit.filing_date),
        permitStatus: permit.filing_status || undefined,
        filingIncludes: includes || undefined,
        descriptionOfWork: description || undefined,
        deviceId: deviceMatch?.device_id,
        deviceType: deviceMatch?.device_type,
        deviceStatus: deviceMatch?.device_status,
        elevatorType: deviceMatch?.elevator_type,
        latestCertificateOfOccupancyDate: formatDate(coMatch?.c_o_issue_date),
        recentSaleDate: formatDate(recentSale?.documentDate),
        recentSaleAmount: recentSale?.amount || undefined,
        recentRecordedParty: recentSale?.partyName || undefined,
        hpdRegistrationDate: formatDate(hpdMatch?.lastregistrationdate),
        hpdRegistrationEndDate: formatDate(hpdMatch?.registrationenddate),
        modernizationSignalScore: score,
        modernizationSignalTier: tier,
        signalSummary: signals.length ? signals : ['Recent elevator filing loaded'],
        recommendedAction: recommendedActionForTier(tier),
      };
    })
    .sort((left, right) => right.modernizationSignalScore - left.modernizationSignalScore)
    .slice(0, 80);

  const sources: ElevatorIntelligenceSourceStatus[] = [
    {
      key: 'permits',
      label: 'DOB elevator permits and applications',
      sourceUrl: SOURCE_URLS.permits,
      count: permits.length,
      latestAt: permits[0]?.filing_date,
      note: 'Primary modernization and replacement filing feed.',
    },
    {
      key: 'devices',
      label: 'DOB inspections and device status',
      sourceUrl: SOURCE_URLS.devices,
      count: devices.length,
      latestAt: devices[0]?.job_filing_number,
      note: 'Device inventory and work-in-progress status tied to jobs and addresses.',
    },
    {
      key: 'violations',
      label: 'DOB violations',
      sourceUrl: SOURCE_URLS.violations,
      count: violations.length,
      latestAt: violations[0]?.issue_date,
      note: 'Imported as a live enforcement layer pending address-level reconciliation.',
    },
    {
      key: 'hpd',
      label: 'HPD registration',
      sourceUrl: SOURCE_URLS.hpd,
      count: hpdRegistrations.length,
      latestAt: hpdRegistrations[0]?.lastregistrationdate,
      note: 'Used for residential owner-registration context.',
    },
    {
      key: 'co',
      label: 'Certificate of occupancy history',
      sourceUrl: SOURCE_URLS.co,
      count: certificatesOfOccupancy.length,
      latestAt: certificatesOfOccupancy[0]?.c_o_issue_date,
      note: 'Latest CO issuance adds building-history context.',
    },
    {
      key: 'sales',
      label: 'ACRIS sales',
      sourceUrl: SOURCE_URLS.acrisMaster,
      count: recentDeeds.length,
      latestAt: recentDeeds[0]?.recorded_datetime,
      note: 'Recent deed activity used as a capital-intent signal.',
    },
    {
      key: 'owner-records',
      label: 'Owner and management records',
      sourceUrl: SOURCE_URLS.acrisParties,
      count: acrisParties.length,
      latestAt: recentDeeds[0]?.document_date,
      note: 'Recorded party names are joined to recent deed activity.',
    },
  ];

  return {
    sources,
    opportunities,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchPreFilingElevatorOpportunities(): Promise<ElevatorIntelligencePayload> {
  const [violations, complaints311] = await Promise.all([
    fetchRows<ViolationRow>('8qed-xr5q', {
      $select: 'ecb_violation_number,issue_date,severity,violation_type,respondent_name',
      $order: 'issue_date DESC',
      $limit: '120',
    }),
    fetchRows<Complaint311Row>('erm2-nwe9', {
      $select: 'unique_key,created_date,descriptor,incident_address,borough,incident_zip,bbl,status',
      $where: "complaint_type = 'Elevator'",
      $order: 'created_date DESC',
      $limit: '1200',
    }),
  ]);

  const complaintsByAddress = new Map<
    string,
    {
      count: number;
      latest?: string;
      descriptor?: string;
      borough?: string;
      zip?: string;
      bbl?: string;
    }
  >();

  complaints311.forEach((complaint) => {
    const addressKey = normalizeLooseAddress(complaint.incident_address);
    if (!addressKey) return;
    const existing = complaintsByAddress.get(addressKey) || { count: 0 };
    complaintsByAddress.set(addressKey, {
      count: existing.count + 1,
      latest: existing.latest && existing.latest > String(complaint.created_date || '') ? existing.latest : complaint.created_date,
      descriptor: existing.descriptor || complaint.descriptor,
      borough: existing.borough || complaint.borough,
      zip: existing.zip || complaint.incident_zip,
      bbl: existing.bbl || complaint.bbl,
    });
  });

  const targetComplaintEntries = Array.from(complaintsByAddress.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 120);
  const targetAddresses = targetComplaintEntries.map(([address]) => address).filter(Boolean);
  const targetBbls = Array.from(
    new Set(targetComplaintEntries.map(([, complaint]) => normalizeDigits(complaint.bbl)).filter((value) => value.length === 10)),
  );

  const [permits, devices, hpdRegistrations, acrisLegals] = await Promise.all([
    Promise.all(
      chunkIds(targetBbls, 40).map((chunk) =>
        fetchRows<ElevatorPermitRow>('kfp4-dz4h', {
          $select: 'job_filing_number,filing_date,filing_status,house_number,street_name,borough,zip,bbl,descriptionofwork',
          $where: `bbl in(${buildInClause(chunk)})`,
          $order: 'filing_date DESC',
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
    Promise.all(
      chunkIds(targetAddresses, 40).map((chunk) =>
        fetchRows<ElevatorDeviceRow>('juyv-2jek', {
          $select: 'job_filing_number,device_id,device_type,device_status,elevator_type,physical_address',
          $where: buildAddressInWhere('physical_address', chunk),
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
    Promise.all(
      chunkIds(targetBbls, 20).map((chunk) =>
        fetchRows<HpdRegistrationRow>('tesw-yqqr', {
          $select: 'boro,housenumber,streetname,zip,block,lot,bin,lastregistrationdate,registrationenddate',
          $where: buildBblTripletWhere(chunk, { borough: 'boroid', block: 'block', lot: 'lot' }),
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
    Promise.all(
      chunkIds(targetBbls, 20).map((chunk) =>
        fetchRows<AcrisLegalRow>('8h5j-fqxa', {
          $select: 'document_id,borough,block,lot,street_number,street_name,unit',
          $where: buildBblTripletWhere(chunk, { borough: 'borough', block: 'block', lot: 'lot' }),
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
  ]);

  const legalDocumentIds = Array.from(new Set(acrisLegals.map((row) => String(row.document_id || '').trim()).filter(Boolean)));
  const deedChunks = chunkIds(legalDocumentIds, 40);
  const [recentDeeds, acrisParties] = await Promise.all([
    Promise.all(
      deedChunks.map((chunk) =>
        fetchRows<AcrisMasterRow>('bnx9-e6tj', {
          $select: 'document_id,doc_type,document_date,document_amt,recorded_datetime,recorded_borough',
          $where: `document_id in(${buildInClause(chunk)}) and doc_type = 'DEED'`,
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
    Promise.all(
      deedChunks.map((chunk) =>
        fetchRows<AcrisPartyRow>('636b-3b5g', {
          $select: 'document_id,party_type,name',
          $where: `document_id in(${buildInClause(chunk)})`,
          $limit: '500',
        }),
      ),
    ).then((groups) => groups.flat()),
  ]);

  const activePermitAddresses = new Set(
    permits
      .filter((permit) => {
        const description = normalizeText(permit.descriptionofwork);
        return /MODERN|ALTERATION|REPLACEMENT/.test(description || 'MODERN');
      })
      .map((permit) => normalizeAddress(permit.house_number, permit.street_name))
      .filter(Boolean),
  );

  const deviceCountByAddress = new Map<string, number>();
  const representativeDeviceByAddress = new Map<string, ElevatorDeviceRow>();
  devices.forEach((device) => {
    const addressKey = normalizeLooseAddress(device.physical_address);
    if (!addressKey) return;
    deviceCountByAddress.set(addressKey, (deviceCountByAddress.get(addressKey) || 0) + 1);
    if (!representativeDeviceByAddress.has(addressKey)) {
      representativeDeviceByAddress.set(addressKey, device);
    }
  });

  const hpdByBbl = new Map<string, HpdRegistrationRow>();
  hpdRegistrations.forEach((record) => {
    const bblKey = buildBblKey(record.boro, record.block, record.lot);
    if (bblKey && !hpdByBbl.has(bblKey)) {
      hpdByBbl.set(bblKey, record);
    }
  });

  const acrisMasterByDocumentId = new Map<string, AcrisMasterRow>();
  recentDeeds.forEach((record) => {
    const documentId = String(record.document_id || '').trim();
    if (documentId) acrisMasterByDocumentId.set(documentId, record);
  });

  const acrisPartyByDocumentId = new Map<string, AcrisPartyRow[]>();
  acrisParties.forEach((record) => {
    const documentId = String(record.document_id || '').trim();
    if (!documentId) return;
    const existing = acrisPartyByDocumentId.get(documentId) || [];
    existing.push(record);
    acrisPartyByDocumentId.set(documentId, existing);
  });

  const recentSaleByBbl = new Map<string, { documentDate?: string; amount?: number; partyName?: string }>();
  const ownerByAddress = new Map<string, string>();
  acrisLegals.forEach((record) => {
    const documentId = String(record.document_id || '').trim();
    const bblKey = buildBblKey(record.borough, record.block, record.lot);
    const addressKey = normalizeAddress(record.street_number, record.street_name);
    const deed = acrisMasterByDocumentId.get(documentId);
    const parties = acrisPartyByDocumentId.get(documentId) || [];
    const namedParty = parties.find((party) => normalizeText(party.name));

    if (addressKey && namedParty?.name && !ownerByAddress.has(addressKey)) {
      ownerByAddress.set(addressKey, namedParty.name);
    }

    if (!documentId || !bblKey || recentSaleByBbl.has(bblKey)) return;

    recentSaleByBbl.set(bblKey, {
      documentDate: deed?.document_date || deed?.recorded_datetime,
      amount: toNumber(deed?.document_amt),
      partyName: namedParty?.name,
    });
  });

  const opportunities: ElevatorOpportunity[] = targetComplaintEntries
    .map(([addressKey, complaint]) => {
      const device = representativeDeviceByAddress.get(addressKey);
      const activeFiling = activePermitAddresses.has(addressKey);
      const bblKey = normalizeDigits(complaint.bbl);
      const hpdMatch = hpdByBbl.get(bblKey);
      const recentSale = recentSaleByBbl.get(bblKey);
      const ownerFromAddress = ownerByAddress.get(addressKey);
      const deviceCount = deviceCountByAddress.get(addressKey) || 0;

      let score = 0;
      const signals: string[] = [];

      if (complaint.count >= 4) {
        score += 35;
        signals.push('Multiple 311 elevator complaints at this address');
      } else if (complaint.count >= 2) {
        score += 20;
        signals.push('Repeat 311 elevator complaints at this address');
      } else {
        score += 8;
        signals.push('Recent 311 elevator complaint on file');
      }

      if (deviceCount > 1) {
        score += 18;
        signals.push('Multiple elevator devices on property');
      }

      if (device && normalizeText(device.device_status) !== 'WORK IN PROGRESS') {
        score += 15;
        signals.push(`Device status is ${device.device_status || 'active'}, not work in progress`);
      }

      if (recentSale?.documentDate) {
        score += 10;
        signals.push('Recent deed activity suggests ownership attention or capital review');
      }

      if (hpdMatch?.lastregistrationdate) {
        score += 8;
        signals.push('HPD registration available for owner lookup');
      }

      if (activeFiling) {
        score -= 30;
        signals.push('Modernization or related filing already in motion');
      } else {
        score += 18;
        signals.push('No recent modernization filing detected yet');
      }

      const tier = computeTier(score);

      return {
        id: `prefiling-${addressKey}`,
        jobFilingNumber: activeFiling ? 'In motion elsewhere' : 'No active filing',
        address: addressKey,
        borough: complaint.borough || 'Unknown',
        zipCode: complaint.zip,
        bbl: bblKey || undefined,
        ownerName: recentSale?.partyName || ownerFromAddress || undefined,
        managementCompany: recentSale?.partyName || ownerFromAddress || undefined,
        deviceId: device?.device_id,
        deviceType: device?.device_type,
        deviceStatus: device?.device_status,
        elevatorType: device?.elevator_type,
        recentSaleDate: formatDate(recentSale?.documentDate),
        recentSaleAmount: recentSale?.amount || undefined,
        recentRecordedParty: recentSale?.partyName || ownerFromAddress || undefined,
        hpdRegistrationDate: formatDate(hpdMatch?.lastregistrationdate),
        hpdRegistrationEndDate: formatDate(hpdMatch?.registrationenddate),
        complaintCount311: complaint.count,
        lastComplaintDate311: formatDate(complaint.latest),
        complaintDescriptor311: complaint.descriptor,
        activeModernizationFiling: activeFiling,
        modernizationSignalScore: score,
        modernizationSignalTier: tier,
        signalSummary: signals,
        recommendedAction: activeFiling
          ? 'Review this address as a competitive account, not a clean pre-filing opportunity.'
          : recommendedActionForTier(tier),
      };
    })
    .sort((left, right) => right.modernizationSignalScore - left.modernizationSignalScore)
    .slice(0, 100);

  const sources: ElevatorIntelligenceSourceStatus[] = [
    {
      key: '311',
      label: '311 elevator complaints',
      sourceUrl: 'https://data.cityofnewyork.us/d/erm2-nwe9',
      count: complaints311.length,
      latestAt: complaints311[0]?.created_date,
      note: 'Primary pre-filing pain signal for repeated elevator complaints.',
    },
    {
      key: 'devices',
      label: 'DOB inspections and device status',
      sourceUrl: SOURCE_URLS.devices,
      count: devices.length,
      latestAt: devices[0]?.job_filing_number,
      note: 'Used to identify device count and exclude work-in-progress conditions.',
    },
    {
      key: 'hpd',
      label: 'HPD registration',
      sourceUrl: SOURCE_URLS.hpd,
      count: hpdRegistrations.length,
      latestAt: hpdRegistrations[0]?.lastregistrationdate,
      note: 'Used for owner and registration context.',
    },
    {
      key: 'sales',
      label: 'ACRIS sales',
      sourceUrl: SOURCE_URLS.acrisMaster,
      count: recentDeeds.length,
      latestAt: recentDeeds[0]?.recorded_datetime,
      note: 'Used for ownership and recent transfer signals.',
    },
    {
      key: 'owner-records',
      label: 'Owner and management records',
      sourceUrl: SOURCE_URLS.acrisParties,
      count: acrisParties.length,
      latestAt: recentDeeds[0]?.document_date,
      note: 'Recorded party names used for outreach context.',
    },
    {
      key: 'violations',
      label: 'DOB violations',
      sourceUrl: SOURCE_URLS.violations,
      count: violations.length,
      latestAt: violations[0]?.issue_date,
      note: 'Loaded as a source layer; this dataset does not expose address/BBL for clean per-building matching.',
    },
  ];

  return {
    sources,
    opportunities,
    updatedAt: new Date().toISOString(),
  };
}
