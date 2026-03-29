#!/usr/bin/env node
/**
 * Merge a CSV export (Excel / Google Sheets → Save as CSV) into public/data/license-lookup.json.
 *
 * Expected columns (header row; names are matched case-insensitively):
 *   - License number  → license_number
 *   - Company name    → business_name
 *   - License holder  → contact_name
 *   - Phone             → phone
 *
 * Aliases also accepted: license, lic #, company, business, contact, phone number, etc.
 *
 * Usage:
 *   node scripts/merge-license-lookup.mjs path/to/your-export.csv
 *   npm run license:merge -- path/to/your-export.csv
 *
 * Merge rules:
 *   - Matches existing rows by license_number (trimmed) first, else by company name (case-insensitive).
 *   - Non-empty CSV cells update that field; empty cells keep the previous value in JSON.
 *   - Extra fields on existing records (e.g. insurance) are preserved.
 *   - New combinations append as new records.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const LOOKUP_PATH = path.join(projectRoot, 'public', 'data', 'license-lookup.json');

const HEADER_MAP = [
  { key: 'license_number', aliases: ['license_number', 'license number', 'license', 'lic #', 'lic#', 'lic no', 'lic'] },
  { key: 'business_name', aliases: ['business_name', 'company name', 'company', 'business', 'firm'] },
  { key: 'contact_name', aliases: ['contact_name', 'license holder', 'holder', 'contact', 'name'] },
  { key: 'phone', aliases: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'cell'] },
];

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  const len = text.length;

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mapHeaders(headerRow) {
  const indices = {};
  const normalizedCells = headerRow.map((cell) => normalizeHeader(cell));

  for (const { key, aliases } of HEADER_MAP) {
    let idx = -1;
    for (let c = 0; c < normalizedCells.length; c++) {
      const n = normalizedCells[c];
      if (aliases.includes(n)) {
        idx = c;
        break;
      }
    }
    if (idx === -1) {
      for (let c = 0; c < normalizedCells.length; c++) {
        const n = normalizedCells[c];
        if (aliases.some((a) => n === a || n.includes(a) || a.includes(n))) {
          idx = c;
          break;
        }
      }
    }
    indices[key] = idx;
  }
  return indices;
}

function rowToRecord(headerIndices, row) {
  const rec = {};
  for (const key of ['license_number', 'business_name', 'contact_name', 'phone']) {
    const idx = headerIndices[key];
    rec[key] = idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';
  }
  return rec;
}

function findRecordIndex(records, lic, bizUpper) {
  if (lic) {
    const byLic = records.findIndex((r) => String(r.license_number || '').trim() === lic);
    if (byLic !== -1) return byLic;
  }
  if (bizUpper) {
    const byBiz = records.findIndex(
      (r) => String(r.business_name || '').trim().toUpperCase() === bizUpper
    );
    if (byBiz !== -1) return byBiz;
  }
  return -1;
}

function applyMerge(existing, incoming) {
  const out = { ...existing };
  for (const key of ['license_number', 'business_name', 'contact_name', 'phone']) {
    const v = incoming[key];
    if (v !== undefined && String(v).trim() !== '') {
      out[key] = String(v).trim();
    }
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2] || process.env.LICENSE_IMPORT;
  if (!csvPath) {
    console.error('Usage: node scripts/merge-license-lookup.mjs <path-to.csv>');
    console.error('   or: npm run license:merge -- <path-to.csv>');
    process.exit(1);
  }

  const resolved = path.isAbsolute(csvPath) ? csvPath : path.join(projectRoot, csvPath);
  const raw = await readFile(resolved, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length < 2) {
    console.error('CSV must include a header row and at least one data row.');
    process.exit(1);
  }

  const headerIndices = mapHeaders(rows[0]);
  const missing = HEADER_MAP.filter(({ key }) => headerIndices[key] < 0).map(({ key }) => key);
  if (missing.length === HEADER_MAP.length) {
    console.error('Could not match any columns. First row:', rows[0]);
    console.error('Expected headers like: Company name, License number, License holder, Phone');
    process.exit(1);
  }
  if (missing.length) {
    console.warn('Warning: unmatched columns (will be left empty if new rows):', missing.join(', '));
  }

  const lookupJson = JSON.parse(await readFile(LOOKUP_PATH, 'utf8'));
  const records = Array.isArray(lookupJson.records) ? [...lookupJson.records] : [];

  let updated = 0;
  let added = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !String(c || '').trim())) continue;

    const incoming = rowToRecord(headerIndices, row);
    const lic = incoming.license_number.trim();
    const bizUpper = incoming.business_name.trim().toUpperCase();

    if (!lic && !bizUpper && !incoming.phone.trim() && !incoming.contact_name.trim()) {
      continue;
    }

    const idx = findRecordIndex(records, lic, bizUpper);
    if (idx === -1) {
      records.push({
        license_number: lic,
        business_name: incoming.business_name.trim(),
        contact_name: incoming.contact_name.trim(),
        phone: incoming.phone.trim(),
      });
      added += 1;
    } else {
      records[idx] = applyMerge(records[idx], incoming);
      updated += 1;
    }
  }

  lookupJson.records = records;
  lookupJson.generatedAt = new Date().toISOString();

  await writeFile(LOOKUP_PATH, `${JSON.stringify(lookupJson, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${LOOKUP_PATH}`);
  console.log(`Updated ${updated} existing record(s), added ${added} new record(s). Total: ${records.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
