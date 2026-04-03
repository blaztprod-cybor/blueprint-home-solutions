# Blueprint Homeowner Portal Requirements

## Purpose

This document defines the minimum viable homeowner account experience for Blueprint Home Solutions.

If homeowners are going to have accounts in the system, they should have a clear and intentional product path instead of existing as a legacy role with partial access.

## Product Position

The homeowner portal is the `Client` side of the Blueprint marketplace.

The homeowner should be able to:

- submit projects
- manage project details
- receive updates from Blueprint
- review vendor activity and estimates
- participate in introductions

## Minimum Homeowner Account Features

The homeowner account should include the following:

- homeowner login
- homeowner dashboard
- view submitted projects
- upload more photos later
- see status updates
- see rough estimates
- see final estimates
- receive introductions
- respond to introductions

## 1. Homeowner Login

### Objective

The homeowner should be able to sign in and return to their own project data.

### Requirements

- homeowner can authenticate
- homeowner can access only their own account and project records
- homeowner login should route to the homeowner dashboard

## 2. Homeowner Dashboard

### Objective

The homeowner dashboard should provide a simple control center for the client side of the marketplace.

### Dashboard should show

- active projects
- latest project status
- pending intros
- pending estimates
- completed projects

### Dashboard should not feel like a contractor portal

The homeowner dashboard should focus on clarity, trust, and project progress rather than marketplace browsing.

## 3. View Submitted Projects

### Objective

The homeowner should be able to see the projects they already submitted.

### Requirements

Each project view should show:

- project title or category
- description
- uploaded photos
- location summary
- current status
- date created

## 4. Upload More Photos Later

### Objective

The homeowner should be able to add photos after the initial submission.

### Requirements

- homeowner can open a submitted project
- homeowner can upload additional photos
- photos appear in project view
- admin and relevant vendors can see approved project photos as intended by workflow

### Why this matters

Photos are part of the estimate and qualification process. They should not be limited only to the first submission.

## 5. See Status Updates

### Objective

The homeowner should be able to understand where the project stands.

### Minimum statuses visible to homeowner

- submitted
- under review
- vendor interest received
- intro pending
- intro approved
- rough estimates in progress
- final estimates in progress
- closed or completed

### Requirements

- current status must be visible per project
- major status changes should be timestamped
- status wording should be homeowner-friendly

## 6. See Rough Estimates

### Objective

The homeowner should be able to review rough estimates from vendors.

### Requirements

- homeowner can see which vendors submitted rough estimates
- homeowner can see amount and date
- rough estimates should be clearly labeled as preliminary

## 7. See Final Estimates

### Objective

The homeowner should be able to review more formal pricing after the rough estimate stage.

### Requirements

- final estimates should be distinguishable from rough estimates
- homeowner can compare vendor submissions
- homeowner can see estimate date and vendor name

## 8. Receive Introductions

### Objective

The homeowner should be informed when Blueprint approves a vendor introduction.

### Requirements

- homeowner can see that a vendor has been approved for introduction
- homeowner can identify the vendor name and role
- homeowner can access the communication thread or introduction message

## 9. Respond To Introductions

### Objective

The homeowner should be able to respond to Blueprint-managed introductions rather than remaining a passive lead.

### Requirements

- homeowner can acknowledge or respond to the introduction
- homeowner can continue communication through the Blueprint-managed process
- the response should remain visible to Blueprint admin

## Homeowner Portal Workflow

The intended homeowner workflow is:

1. homeowner signs in
2. homeowner lands on dashboard
3. homeowner views submitted projects
4. homeowner uploads more photos if needed
5. homeowner sees project status
6. homeowner reviews vendor estimates
7. homeowner receives and responds to introductions

## Data Implications

To support the homeowner portal, the system should persist:

- homeowner identity
- homeowner project records
- project photos
- project status history
- rough estimate records
- final estimate records
- introduction records
- communication history

## UX Direction

The homeowner experience should be:

- simple
- trustworthy
- mobile-friendly
- easy to understand

It should not feel overloaded with contractor-facing language or admin complexity.

## Strategic Meaning

If Blueprint keeps homeowner accounts, they should be treated as first-class platform users.

That means the platform is not just:

- public lead submission

It becomes:

- a real client-side experience
- a real vendor-side experience
- admin as the gate and coordinator

## Near-Term Recommendation

If Blueprint decides to keep homeowner accounts, this homeowner portal should replace the ambiguous legacy homeowner role.

The product should stop mixing:

- guest-only homeowner assumptions
- partial homeowner account behavior

and instead intentionally support the homeowner as a real client-side user.
