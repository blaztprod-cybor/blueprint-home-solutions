# Blueprint Home Solutions System Blueprint

## Product Model

Blueprint Home Solutions should operate as a managed two-sided marketplace.

There are three roles in the system:

- `Client`
- `Vendor`
- `Blueprint Admin`

Blueprint is not just a passive listing board. Blueprint acts as the gate between clients and vendors and controls trust, introductions, and workflow.

## Entry Point

A guest should enter the platform by choosing one of two paths:

- `I Need Help`
- `I Provide Services`

This is the cleanest front-door model because it removes ambiguity and immediately places the user into the correct workflow.

## Role Definitions

### Client

A client is a homeowner, property owner, or person seeking home improvement services.

Client responsibilities:

- describe the project
- provide contact details
- upload photos
- provide timing and budget expectations

Client should not need to browse the vendor system directly in an uncontrolled way.

### Vendor

A vendor is a contractor, tradesman, or home professional.

Vendor responsibilities:

- create an account
- complete profile
- provide trade information
- provide service area
- provide license information if applicable
- request introductions
- submit estimates

### Blueprint Admin

Blueprint Admin is the operational gate between the two sides.

Admin responsibilities:

- review leads/projects
- verify vendors
- control access
- approve introductions
- manage communication
- maintain notes and history
- monitor the estimate workflow

## Client Experience

The client path should be:

1. choose `I Need Help`
2. enter project details
3. upload photos
4. submit project request
5. receive Blueprint confirmation
6. receive updates as vendors request access or estimates

At early stages, the client may not need a full self-service account. But the system must still treat the client as a real participant with a clear record in the database.

## Vendor Experience

The vendor path should be:

1. choose `I Provide Services`
2. create account
3. complete profile
4. undergo verification
5. gain access to opportunities if eligible
6. request introductions
7. submit rough estimates
8. move toward final estimate or project conversion

Vendors are true platform users and should have a distinct portal experience.

## Blueprint Gate

Blueprint Admin should control the connection between clients and vendors.

Key rule:

- vendors do not receive unrestricted client contact details automatically
- Blueprint manages introductions
- Blueprint can approve, delay, or decline access

This gate is central to trust, safety, and workflow clarity.

## Core Workflow

The intended end-to-end workflow is:

1. Client submits project request.
2. Project appears in admin intake.
3. Eligible vendors see a sanitized opportunity.
4. Vendor requests introduction or estimate opportunity.
5. Admin reviews request.
6. Admin contacts client if needed.
7. Admin approves introduction.
8. Blueprint opens a shared communication thread.
9. Vendor provides rough estimate.
10. Vendor may later provide final estimate.

## Marketplace Logic

Blueprint should feel like a market, but not an unmoderated one.

The platform should combine:

- a marketplace structure
- controlled trust and access
- guided communication
- admin oversight

This is closer to:

- a marketplace in activity and matching
- a managed service in trust and workflow

## Photos

Photos are operationally important.

They are not optional decoration. They help vendors:

- understand scope
- form rough estimates
- decide whether to request the job

The system should preserve photos through the client submission and vendor review flow.

## Estimates

The estimate workflow should distinguish clearly between client inputs and vendor inputs.

### Client provides

- description
- photos
- budget expectation
- timing expectation

### Vendor provides

- rough estimate
- final estimate
- scope commentary if needed

The client should not provide the actual estimate. The vendor should.

## Communication Model

Before admin approval:

- Blueprint may communicate with client and vendor separately

After admin approval:

- Blueprint should create one shared introduction thread
- client, vendor, and admin should remain on the same thread

This reduces confusion and gives Blueprint operational visibility.

## Data Concepts

A cleaner long-term model should revolve around:

- `clients`
- `vendors`
- `projects`
- `project_photos`
- `intro_requests`
- `communications`
- `activity_history`

This is more coherent than mixing leads and projects without strict boundaries.

## What To Keep

The following concepts are still valuable and should remain:

- admin intake
- vendor verification
- controlled introductions
- rough estimate stage
- photo-driven qualification
- admin visibility into communication

## What To Change

The following areas should be simplified or rebuilt:

- contradictory homeowner lead vs project path
- unclear separation between lead intake and project flow
- fragmented message handling
- photo storage instability
- overlapping admin navigation

## Strategic Direction

Blueprint started with a simpler lead-generation model, but the platform now clearly wants to become a true two-sided marketplace.

The product should therefore move toward:

- clear client path
- clear vendor path
- strong admin gate
- structured introduction workflow
- project and estimate lifecycle

## Near-Term Priority

To move in this direction without rebuilding everything at once, near-term work should focus on:

1. stabilizing client submission
2. stabilizing photo handling
3. preserving admin intake visibility
4. implementing admin introduction approval
5. building shared communication threads

This gives Blueprint a coherent marketplace backbone while staying practical for a small company.
