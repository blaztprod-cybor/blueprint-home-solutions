# Blueprint Home Solutions Lead Introduction Product Requirements

## Purpose

This document converts the vendor onboarding policy into product requirements for the lead introduction workflow.

The goal is to help Blueprint operate a controlled homeowner-to-vendor introduction process that works for a small company now and can scale later.

## Product Goal

Blueprint should not function as a passive lead board.

Blueprint should:

- receive a homeowner lead
- allow verified Home Pros to request introductions
- let admin review and control introductions
- notify both parties as the request moves forward
- maintain a record of what happened and when

## Scope

This requirements set covers:

- admin intro approval
- automated acknowledgment emails
- request statuses
- admin notes and history

This does not yet require:

- live chat
- SMS
- payment processing
- full CRM features

## Core Workflow

1. Homeowner submits a lead.
2. Lead appears in admin intake.
3. Sanitized lead appears to eligible Home Pros.
4. Home Pro requests introduction.
5. Admin reviews the request.
6. Admin either approves, declines, or leaves it pending.
7. Blueprint sends the appropriate homeowner and Home Pro notifications.
8. Admin can record notes and history throughout the process.

## 1. Admin Intro Approval

### Objective

Admin must have a clear action that connects the dots between a Home Pro request and the homeowner lead.

### Requirements

- Each Home Pro request must show an admin action area.
- Admin must be able to:
  - mark request as `Admin Reviewing`
  - approve introduction
  - decline introduction
  - mark homeowner contacted
  - mark homeowner confirmed
  - close request

### Minimum Admin Actions

- `Start Review`
- `Approve Introduction`
- `Decline`
- `Mark Homeowner Contacted`
- `Mark Homeowner Confirmed`
- `Close`

### Approval Outcome

When admin approves an introduction:

- request status changes to `Introduction Approved`
- a timestamp is stored
- admin can optionally attach a short note
- automated messages are sent to both parties

### Decline Outcome

When admin declines:

- request status changes to `Declined`
- decline reason is optionally recorded
- Home Pro receives a decline/update message
- homeowner is not contacted unless admin chooses to do so

## 2. Automated Acknowledgment Emails

### Objective

The system should acknowledge major workflow events automatically, so the company is not forced to manually send every message.

### Required Email Events

#### Homeowner

- lead submitted
- vendor interest under review
- introduction approved

#### Home Pro

- introduction request received
- request under review
- introduction approved
- introduction declined

### Admin Copy Rule

During the early operating stage, admin should receive a copy of all key automated workflow emails.

Minimum rule:

- send to the intended recipient
- copy Blueprint admin on the same message whenever operational visibility matters

This should apply to:

- homeowner lead submission acknowledgment
- Home Pro platform join/welcome acknowledgment
- Home Pro introduction request acknowledgment
- homeowner review/update message
- introduction approval
- introduction decline
- major workflow status changes

### Why Admin Should Be Copied

Blueprint is still a small company and needs operational visibility more than strict inbox separation.

Admin copy provides:

- a lightweight audit trail
- easier manual follow-up
- less confusion about what each side already received
- continuity when one person is running operations

### Minimum Email Content

Each email should include:

- plain-English status
- project category or short lead label
- what happens next
- who will follow up
- a clear statement that Blueprint is coordinating the introduction

### Operational Rule

Automated emails should confirm process state, not overpromise timing.

Good example:

- "Your request has been received and is under review."

Bad example:

- "You will definitely hear from us within one hour."

### Future Extension

Later versions can include:

- SMS
- in-app notifications
- admin-triggered templates

## 3. Request Statuses

### Objective

The introduction workflow needs a status model that reflects real operations instead of only raw lead creation.

### Required Status Set

For Home Pro introduction requests, use:

- `Requested`
- `Admin Reviewing`
- `Homeowner Contact Pending`
- `Homeowner Confirmed`
- `Introduction Approved`
- `Declined`
- `Closed`

### Status Definitions

#### Requested

The Home Pro has submitted a request through Blueprint.

#### Admin Reviewing

An admin has opened the request and is evaluating fit, readiness, or vendor eligibility.

#### Homeowner Contact Pending

Admin intends to contact the homeowner but contact has not yet been confirmed.

#### Homeowner Confirmed

The homeowner has been contacted and is open to the introduction.

#### Introduction Approved

Blueprint has approved the match and released the introduction according to platform policy.

#### Declined

Blueprint decided not to move forward with this request.

#### Closed

The request is complete, inactive, or no further action is expected.

### Status Rules

- New Home Pro requests start as `Requested`
- Only admin can move a request past `Requested`
- Status changes must be timestamped
- Status changes should be visible in admin history

## Shared Introduction Thread

### Objective

Once admin approves a connection, communication should move from separate fragmented messages into one shared Blueprint-managed introduction thread.

### Rules

Before approval:

- homeowner and Home Pro messages may remain separate
- Blueprint may communicate with each side independently

At approval:

- Blueprint should send one introduction email thread
- homeowner, Home Pro, and admin should all be included
- Blueprint should remain copied on the thread

### Recommended Thread Structure

- `From:` Blueprint Home Solutions
- `To:` homeowner and Home Pro
- `CC:` admin or Blueprint operations mailbox

### Benefits

- one conversation trail
- less confusion between parties
- easier follow-up from mobile
- stronger operational visibility for Blueprint

## 4. Admin Notes And History

### Objective

Admin needs a working record of what has already been done.

Without notes/history, the workflow does not scale even at low volume.

### Requirements

- Each introduction request should have an admin notes section.
- Admin should be able to add internal notes.
- Every status change should create a history entry.
- Every automated email send should create a history entry.
- History should be read-only after creation.

### Notes

Admin notes should support:

- free-text note entry
- author identity
- timestamp

Examples:

- "Called homeowner, left voicemail."
- "Homeowner prefers weekend calls."
- "Contractor specializes in bathroom remodels only."

### History Entry Types

Minimum history types:

- request created
- status changed
- note added
- homeowner email sent
- Home Pro email sent
- introduction approved
- request declined

## Data Model Recommendations

### Existing Collections

- `leads`
- `lead_marketplace`
- `lead_inquiries`

### Recommended Additions

#### Extend `lead_inquiries`

Add fields such as:

- `status`
- `statusUpdatedAt`
- `reviewedBy`
- `approvedAt`
- `declinedAt`
- `declineReason`
- `homeownerContactedAt`
- `homeownerConfirmedAt`
- `introductionThreadId`
- `lastCommunicationAt`

#### Add `lead_inquiry_notes`

Suggested fields:

- `inquiryId`
- `body`
- `authorId`
- `authorName`
- `createdAt`

#### Add `lead_inquiry_history`

Suggested fields:

- `inquiryId`
- `eventType`
- `message`
- `actorId`
- `actorName`
- `metadata`
- `createdAt`

## Admin UI Requirements

### In Lead Intake

For each lead:

- show homeowner details
- show related Home Pro requests
- show request status
- show admin action buttons
- show notes
- show history

### For Each Home Pro Request

Display:

- Home Pro name
- Home Pro email
- message to Blueprint
- current request status
- timestamps
- admin actions

### Admin Actions Panel

Must allow:

- status update
- approve introduction
- decline request
- add note
- trigger or confirm notification send

## Notification Requirements

### Immediate

On request creation:

- send acknowledgment to Home Pro
- create history event
- copy admin

### On Admin Review Start

- optional homeowner or Home Pro message
- create history event
- copy admin when message is sent

### On Approval

- send one shared introduction thread to homeowner and Home Pro
- keep admin copied
- create history event

### On Decline

- send Home Pro decline/update
- copy admin
- create history event

## Project Submission And Estimate Visibility

### Objective

Admin should retain visibility into the full pre-project process, including who has submitted what and when.

### Requirements

Admin should be able to see:

- when a homeowner submits a lead or project
- whether photos were included
- when a Home Pro joins the platform
- when a Home Pro requests introduction
- when a Home Pro is asked to bid or estimate
- when a Home Pro submits a rough estimate
- when a final estimate is submitted

### Operational Rule

No major pre-contract workflow event should be invisible to admin.

## Homeowner Photos And Budget Expectations

### Photos

Homeowner-uploaded photos are useful and should remain part of the workflow when possible.

Photos help with:

- qualifying the job
- understanding scope
- improving estimate accuracy
- reducing unnecessary back-and-forth

### Homeowner Rough Estimate

The homeowner should not provide the actual contractor rough estimate.

Instead, the homeowner should provide:

- budget expectation
- preferred scope
- timeline expectations

### Home Pro Rough Estimate

The rough estimate itself should come from the Home Pro.

Recommended distinction:

- homeowner submits `budget range` or `budget expectation`
- Home Pro submits `rough estimate`
- Home Pro later submits `final estimate`

This keeps the roles clear and avoids mixing customer expectations with vendor pricing.

## MVP Delivery Recommendation

To keep this manageable, build in this order:

1. Admin request statuses
2. Admin approve/decline action
3. Admin notes
4. History log
5. Automated acknowledgment emails

This order gives the team operational control before adding messaging automation.

## Acceptance Criteria

Blueprint should consider this feature ready for broader testing when:

1. A Home Pro request can be created from the marketplace.
2. Admin can review that request in lead intake.
3. Admin can approve or decline it.
4. Status changes persist correctly.
5. Notes can be added and viewed later.
6. History reflects actions and timestamps.
7. Acknowledgment emails send to the correct party at the correct stage.
8. One full introduction test is completed successfully by admin.

## Recommended Next Build Step

The highest-value next implementation is:

- add request statuses plus an `Approve & Send Intro` action inside lead intake

That is the shortest path from "viewer" to "working workflow tool."
