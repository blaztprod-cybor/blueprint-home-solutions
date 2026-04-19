# Filing Contact Crosswalk

## Purpose

Blueprint needs a repeatable way to turn a DOB filing into a usable contact record.

The filing feed and the contact/licensing sources are not the same system:

- `DOB NOW / DOB filings` tell us that a project signal exists
- `contractor / licensing / business / owner sources` help tell us who the filer is and how to reach them

The premium value is not the raw filing. It is the crosswalk between those systems.

## Why Manual Search Is Not Enough

A person can often find a phone number quickly by searching a company name in a browser.

That does not scale well in-product for four reasons:

1. Search-result pages are unstable
   Rankings, snippets, and visible phone numbers change frequently.
2. Search-result pages are not a clean source of record
   They often mix directories, mirrors, stale listings, and unrelated businesses.
3. Automated scraping of search-result pages is brittle
   It commonly breaks on anti-bot controls, layout changes, and rate limits.
4. Search-result pages do not provide clean provenance
   Blueprint should know where a phone number came from and when it was last verified.

This does **not** mean "never automate." It means the automation should be built on stable source ingestion and a persistent crosswalk table, not on scraping search-result pages directly.

## Recommended Automation Model

1. Ingest filing records from DOB.
2. Normalize entity names, addresses, boroughs, and license numbers.
3. Match those filings against source-specific registries.
4. Store the resolved match in a reusable crosswalk table.
5. Reuse verified matches automatically on future filings.
6. Keep low-confidence cases unresolved until more evidence exists.

This is the difference between:

- ad hoc lookup
- and a durable enrichment system

## Entity Classes

Each filing should be classified before enrichment, because not every filer is a contractor.

- `Contractor`
- `Architect / Engineer`
- `Expediter`
- `Developer / Owner`
- `Business / Organization`
- `Public Agency`
- `Unknown`

## Lead Path Meanings

Blueprint should distinguish between direct leads and path-to-the-lead records.

- `Direct`
  The entity is likely the actual contractor or work performer.
- `Indirect`
  The entity may know or control the actual contractor path.
- `Procurement`
  Public-agency or procurement-driven path, not normal outreach.
- `Noise`
  Low-value signal for Blueprint users.
- `Unknown`
  Not enough signal yet.

## Source Types

The crosswalk should support multiple source families:

- `Contractor Database`
- `Professional License`
- `Business Registry`
- `Property Record`
- `Internal Override`
- `User Verified`
- `Unknown`

No single source will cover the whole filing population.

## Matching Hierarchy

Matching should happen in a strict order:

1. Exact license match
2. Exact normalized business name match
3. Exact normalized person name plus geography match
4. Exact address match plus business or person support
5. Reuse previously verified crosswalk match
6. Fuzzy match only when backed by multiple signals

The system should avoid silently accepting weak fuzzy matches.

## Confidence Model

- `High`
  Exact license match or previously verified internal match
- `Medium`
  Strong business/person match plus address or borough support
- `Low`
  Partial or fuzzy match with some evidence
- `Unresolved`
  Not enough evidence to trust the result

Blueprint should prefer showing no phone over showing a bad phone.

## Repo Shape

The first repo-ready pieces are:

- [`public/data/filing-contact-crosswalk.json`](/Users/shawnraynor/Downloads/blueprint-home-solutions/public/data/filing-contact-crosswalk.json)
  Local crosswalk store
- [`public/data/filing-contact-candidates.json`](/Users/shawnraynor/Downloads/blueprint-home-solutions/public/data/filing-contact-candidates.json)
  Candidate discoveries that still need scoring and confirmation
- [`src/services/filingCrosswalkService.ts`](/Users/shawnraynor/Downloads/blueprint-home-solutions/src/services/filingCrosswalkService.ts)
  Loader, classifier, and resolver
- [`scripts/build-filing-crosswalk.mjs`](/Users/shawnraynor/Downloads/blueprint-home-solutions/scripts/build-filing-crosswalk.mjs)
  Converts candidate discoveries into scored crosswalk records
- [`src/services/dobService.ts`](/Users/shawnraynor/Downloads/blueprint-home-solutions/src/services/dobService.ts)
  Filing enrichment path now reads the crosswalk when matches exist
- [`src/types.ts`](/Users/shawnraynor/Downloads/blueprint-home-solutions/src/types.ts)
  Shared entity, confidence, and crosswalk record types

## Crosswalk Record

A stored record should include:

- `id`
- `applicant_license`
- `normalized_applicant_name`
- `normalized_business_name`
- `normalized_address`
- `borough`
- `zip_code`
- `entity_type`
- `lead_path`
- `contact_name`
- `business_name`
- `phone`
- `email`
- `address`
- `source_name`
- `source_type`
- `source_record_id`
- `status`
- `confidence`
- `match_score`
- `matched_on`
- `last_verified_at`
- `notes`

## Candidate Vs Verified

Crosswalk records now support:

- `candidate`
  A discovered match that looks promising but should not auto-fill Filing Leads yet.
- `verified`
  A trusted match that can auto-fill Filing Leads.
- `rejected`
  A known bad match that should not be reconsidered automatically.

This allows Blueprint to automate discovery without polluting the live lead list with weak phones.

## Resolver Flow

The current repo supports this workflow:

1. Add discovered phone candidates to [`public/data/filing-contact-candidates.json`](/Users/shawnraynor/Downloads/blueprint-home-solutions/public/data/filing-contact-candidates.json).
2. Run `npm run crosswalk:build`.
3. The resolver scores those candidates against the filing dataset and writes normalized crosswalk records.
4. Only `verified` records auto-fill into Filing Leads today.

This is the first automation layer. Source fetchers can be added later to generate candidate records automatically.

## Near-Term Build Plan

1. Keep the crosswalk feed local and empty by default.
2. Populate it with a small set of verified examples.
3. Add source-specific ingestion jobs one at a time.
4. Persist successful matches back into the crosswalk.
5. Add internal review tooling only for unresolved or low-confidence cases.

## Product Outcome

If this works well, Blueprint does not just show filings.

It shows:

- who filed
- what kind of entity they are
- how confident Blueprint is in the contact
- whether the record is a direct lead or a path to the contractor

That is the actual premium feature.
