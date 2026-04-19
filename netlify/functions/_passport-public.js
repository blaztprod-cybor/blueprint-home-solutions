import vm from 'node:vm';

const PASSPORT_PUBLIC_SUMMARY_URL = 'https://a0333-passportpublic.nyc.gov/dataJs/chartData.js';
const PASSPORT_PUBLIC_RFX_URL = 'https://a0333-passportpublic.nyc.gov/dataJs/rfxData.js';
const PASSPORT_PUBLIC_CONTRACTS_URL = 'https://a0333-passportpublic.nyc.gov/dataJs/contractData.js';
const PASSPORT_PUBLIC_VENDOR_SUMMARY_URL =
  'https://a0333-passportpublic.nyc.gov/dataJs/complete_entity_summary_website_Entity_Summary_Information.js';
const PASSPORT_PUBLIC_VENDOR_PRINCIPALS_URL =
  'https://a0333-passportpublic.nyc.gov/dataJs/complete_entity_principal_websites_Principals.js';

const CACHE_TTL_MS = 15 * 60 * 1000;
const HOT_CONTRACT_WINDOW_DAYS = 30;

let publicContractsCache = {
  expiresAt: 0,
  payload: null,
};

const TRADE_KEYWORDS = [
  'ELECTRIC',
  'ELECTRICAL',
  'PLUMB',
  'PLUMBING',
  'HVAC',
  'HEATING',
  'VENTILATION',
  'AIR CONDITION',
  'ROOF',
  'ROOFING',
  'MASONRY',
  'CARPENT',
  'WINDOW',
  'DOOR',
  'FACADE',
  'SPRINKLER',
  'FIRE',
  'ALARM',
  'ELEVATOR',
  'ESCALATOR',
  'CONSTRUCTION',
  'RECONSTRUCTION',
  'RENOVATION',
  'MAINTENANCE',
  'REPAIR',
  'SITE WORK',
  'ASBESTOS',
  'ABATEMENT',
  'PAINT',
  'FLOORING',
  'DEMOLITION',
  'SURVEY',
  'ENGINEERING',
  'ARCHITECT',
  'STRUCTURAL',
  'GENERAL CONTRACT',
  'BUILDING',
  'PLAYGROUND',
  'PAVING',
  'CONCRETE',
  'WATERPROOF',
];

const TRADE_INDUSTRY_MARKERS = [
  'CONSTRUCTION',
  'ARCHITECTURE/ENGINEERING',
  'ARCHITECTURE AND ENGINEERING',
  'CONSTRUCTION RELATED',
  'STANDARD SERVICES - CONSTR',
  'PROFESSIONAL SERVICES- CONSTRUCTION RELATED',
];

const EXCLUDED_KEYWORDS = [
  'TOOL',
  'TOOLS',
  'SUPPLY',
  'SUPPLIES',
  'FURNITURE',
  'KIT',
  'EQUIPMENT',
  'SUBSCRIPTION',
  'SOFTWARE',
  'IT PURCHASING',
  'VEHICLE',
  'UNIFORM',
  'OFFICE',
  'HARDWARE',
  'MATERIAL',
  'MATERIALS',
  'RESCUE',
  'COMMODITY',
  'PURCHASING',
  'MTU',
  'LICENSE',
];

const IMPROVEMENT_TYPE_RULES = [
  { label: 'Plumbing', keywords: ['PLUMB', 'SEWER', 'DRAIN', 'WATER MAIN', 'WATER LINE', 'PIPING'] },
  { label: 'Electrical', keywords: ['ELECTRIC', 'ELECTRICAL', 'LIGHTING', 'POWER', 'WIRING'] },
  { label: 'Carpentry', keywords: ['CARPENT', 'MILLWORK', 'CASEWORK', 'WOOD', 'DOOR', 'TRIM'] },
  { label: 'Flooring', keywords: ['FLOOR', 'FLOORING', 'TILE', 'VINYL', 'HARDWOOD'] },
  { label: 'Roofing', keywords: ['ROOF', 'ROOFING', 'FLASHING'] },
  { label: 'Bathrooms', keywords: ['BATHROOM', 'RESTROOM', 'TOILET', 'LAVATORY', 'SHOWER'] },
  { label: 'Fencing', keywords: ['FENCE', 'FENCING', 'GATE'] },
  { label: 'Brickwork', keywords: ['BRICK', 'MASONRY', 'STONE', 'BLOCK'] },
  { label: 'Painting', keywords: ['PAINT', 'COATING', 'STRIPING'] },
  { label: 'Environmental', keywords: ['ASBESTOS', 'ABATEMENT', 'LEAD', 'REMEDIATION', 'ENVIRONMENTAL'] },
  { label: 'Efficiency', keywords: ['ENERGY', 'EFFICIENCY', 'INSULATION', 'WEATHERIZATION', 'RETROFIT'] },
  { label: 'HVAC', keywords: ['HVAC', 'HEATING', 'VENTILATION', 'AIR CONDITION', 'BOILER', 'CHILLER'] },
  { label: 'Fire Protection', keywords: ['SPRINKLER', 'FIRE ALARM', 'FIRE PROTECTION'] },
  { label: 'Concrete', keywords: ['CONCRETE', 'SIDEWALK', 'CURB', 'PAVING'] },
  { label: 'Windows', keywords: ['WINDOW', 'GLAZING', 'GLASS'] },
  { label: 'Doors', keywords: ['DOOR', 'DOORS', 'ENTRY'] },
  { label: 'Demolition', keywords: ['DEMOLITION', 'DEMO'] },
  { label: 'Site Work', keywords: ['SITE WORK', 'EXCAVATION', 'LANDSCAP', 'PLAYGROUND'] },
  { label: 'Architecture & Engineering', keywords: ['ARCHITECT', 'ENGINEERING', 'SURVEY', 'STRUCTURAL', 'TOPOGRAPHIC'] },
];

function extractAssignedArray(scriptText, variableName) {
  const context = {};
  vm.runInNewContext(scriptText, context);

  if (!context[variableName]) {
    throw new Error(`Could not find ${variableName} in PASSPort public dataset.`);
  }

  return context[variableName];
}

function normalizeVendorName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCurrency(value) {
  const normalized = String(value || '').replace(/[^0-9.-]/g, '');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function joinAddress(parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function toIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function buildVendorSummaryMap(rows) {
  const summaryMap = new Map();

  rows.forEach((row) => {
    const vendorName = row[0];
    const key = normalizeVendorName(vendorName);
    if (!key || summaryMap.has(key)) return;

    summaryMap.set(key, {
      vendor_address: joinAddress([row[1], row[2], row[3], row[4], row[5]]),
      vendor_phone: String(row[7] || '').trim(),
    });
  });

  return summaryMap;
}

function buildVendorPrincipalMap(rows) {
  const principalMap = new Map();

  rows.forEach((row) => {
    const vendorName = row[0];
    const key = normalizeVendorName(vendorName);
    if (!key) return;

    const existing = principalMap.get(key);
    const candidate = {
      contact_name: String(row[1] || '').trim(),
      title: String(row[2] || '').trim(),
      ownership_type: String(row[3] || '').trim(),
    };

    if (!candidate.contact_name) return;

    if (!existing) {
      principalMap.set(key, candidate);
      return;
    }

    const existingPriority = existing.ownership_type === 'Principal Owner' ? 2 : existing.ownership_type === 'Officer' ? 1 : 0;
    const candidatePriority = candidate.ownership_type === 'Principal Owner' ? 2 : candidate.ownership_type === 'Officer' ? 1 : 0;

    if (candidatePriority > existingPriority) {
      principalMap.set(key, candidate);
    }
  });

  return principalMap;
}

function buildSummaryCounts(rows) {
  return rows.reduce(
    (accumulator, entry) => {
      accumulator[entry.name] = Number(entry.data || 0);
      return accumulator;
    },
    {}
  );
}

function hasTradeKeyword(...values) {
  const haystack = values
    .map((value) => String(value || '').toUpperCase())
    .join(' ');

  return TRADE_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function hasTradeIndustry(value) {
  const industry = String(value || '').toUpperCase();
  return TRADE_INDUSTRY_MARKERS.some((marker) => industry.includes(marker));
}

function hasExcludedKeyword(...values) {
  const haystack = values
    .map((value) => String(value || '').toUpperCase())
    .join(' ');

  return EXCLUDED_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function detectImprovementTypes(...values) {
  const haystack = values
    .map((value) => String(value || '').toUpperCase())
    .join(' ');

  return IMPROVEMENT_TYPE_RULES
    .filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))
    .map((rule) => rule.label);
}

function isTradeRelevantRfx(row) {
  const industry = row[3];
  const title = row[5];
  const commodity = row[10];
  const program = row[2];

  return hasTradeIndustry(industry) || hasTradeKeyword(title, commodity, program);
}

function isTradeRelevantContract(row) {
  const industry = row[17];
  const title = row[3];
  const program = row[6];
  const procurementMethod = row[7];
  const status = row[9];
  const titleOrScope = [title, program, procurementMethod, industry, status];

  if (hasExcludedKeyword(...titleOrScope)) {
    return false;
  }

  return hasTradeIndustry(industry) || hasTradeKeyword(title, program, procurementMethod);
}

export async function fetchPassportPublicContracts() {
  if (publicContractsCache.payload && Date.now() < publicContractsCache.expiresAt) {
    return publicContractsCache.payload;
  }

  const [
    summaryScript,
    rfxScript,
    contractScript,
    vendorSummaryScript,
    vendorPrincipalsScript,
  ] = await Promise.all([
    fetch(PASSPORT_PUBLIC_SUMMARY_URL).then((response) => response.text()),
    fetch(PASSPORT_PUBLIC_RFX_URL).then((response) => response.text()),
    fetch(PASSPORT_PUBLIC_CONTRACTS_URL).then((response) => response.text()),
    fetch(PASSPORT_PUBLIC_VENDOR_SUMMARY_URL).then((response) => response.text()),
    fetch(PASSPORT_PUBLIC_VENDOR_PRINCIPALS_URL).then((response) => response.text()),
  ]);

  const summaryRows = extractAssignedArray(summaryScript, 'chart_public_sum');
  const rfxRows = extractAssignedArray(rfxScript, 'public_rfx_data');
  const contractRows = extractAssignedArray(contractScript, 'public_ctr_data');
  const vendorSummaryRows = extractAssignedArray(
    vendorSummaryScript,
    'complete_entity_summary_website_Entity_Summary_Information'
  );
  const vendorPrincipalRows = extractAssignedArray(
    vendorPrincipalsScript,
    'complete_entity_principal_websites_Principals'
  );

  buildSummaryCounts(summaryRows);
  const vendorSummaryMap = buildVendorSummaryMap(vendorSummaryRows);
  const vendorPrincipalMap = buildVendorPrincipalMap(vendorPrincipalRows);

  const relevantContractRows = contractRows.filter((row) => isTradeRelevantContract(row));
  const registeredContractRows = relevantContractRows.filter(
    (row) => String(row[9] || '').trim().toUpperCase() === 'REGISTERED'
  );
  const hotWindowStart = Date.now() - HOT_CONTRACT_WINDOW_DAYS * 86400000;

  const awardedContracts = registeredContractRows
    .filter((row) => {
      const registrationTimestamp = new Date(String(row[16] || '').trim()).getTime();
      return Number.isFinite(registrationTimestamp) && registrationTimestamp >= hotWindowStart;
    })
    .sort((left, right) => new Date(right[16]).getTime() - new Date(left[16]).getTime())
    .map((row) => {
      const vendorName = String(row[5] || '').trim();
      const vendorKey = normalizeVendorName(vendorName);
      const vendorSummary = vendorSummaryMap.get(vendorKey) || {};
      const vendorPrincipal = vendorPrincipalMap.get(vendorKey) || {};

      return {
        id: String(row[0] || row[2] || row[1]),
        source: 'PASSPort',
        record_type: 'awarded_contract',
        title: String(row[3] || '').trim(),
        agency: String(row[4] || '').trim(),
        status: String(row[9] || '').trim(),
        industry: String(row[17] || '').trim(),
        procurement_method: String(row[7] || '').trim(),
        contract_id: String(row[2] || '').trim(),
        epin: String(row[1] || '').trim(),
        vendor_name: vendorName,
        vendor_phone: vendorSummary.vendor_phone || '',
        vendor_address: vendorSummary.vendor_address || '',
        contact_name: vendorPrincipal.contact_name || '',
        amount: parseCurrency(row[11]) ?? parseCurrency(row[10]),
        award_date: '',
        registration_date: toIsoDate(row[16]),
        source_url: 'https://a0333-passportpublic.nyc.gov/contracts.html',
        improvement_types: detectImprovementTypes(row[3], row[6], row[7], row[17]),
      };
    });

  const payload = {
    summary: {
      hot_window_days: HOT_CONTRACT_WINDOW_DAYS,
      awarded_contracts: awardedContracts.length,
    },
    awardedContracts,
    source: {
      contracts: 'https://a0333-passportpublic.nyc.gov/contracts.html',
      vendors: 'https://a0333-passportpublic.nyc.gov/vendor.html',
    },
  };

  publicContractsCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  };

  return payload;
}
