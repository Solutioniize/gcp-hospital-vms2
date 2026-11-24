# Hospital Vendor Management System (GCP)

A vendor management system for clinical research, built to support **Good Clinical Practice
(ICH E6(R3))** oversight of service providers. It runs on Cloudflare Workers with React Router 7.

## Feature: vendor onboarding and qualification

- **Vendor register.** Holds each vendor's service category, contacts and **risk-based criticality**
  (high, medium or low). Criticality sets which documents are required and how often the vendor
  must be requalified (every 1, 2 or 3 years).
- **Controlled documents.** Files are stored in R2 with a SHA-256 checksum, version history,
  issue and expiry dates. A new version supersedes the old one, and nothing is deleted.
- **Qualification assessment.** A weighted risk questionnaire produces a risk score and a
  recommended outcome. A **second person** must approve the decision with an electronic
  signature: they retype their sign-in email and confirm the meaning of the signature.
  The decision can be Qualified, Conditionally qualified (conditions required) or Disqualified.
  A vendor cannot be fully qualified while a required document is missing or expired.
- **Dashboard.** Shows assessments waiting for approval, documents that are expired or expiring
  within 2 months, and requalifications that are due or overdue.
- **Audit trail.** Every change records who made it, when, the old and new values, and the reason.
  Editing vendor details requires a reason. The `audit_log` table is append-only: database
  triggers reject any UPDATE or DELETE.

> **Compliance note:** these are technical controls. Full 21 CFR Part 11 / EU Annex 11
> compliance also needs computerised system validation, SOPs, access management and training.

## Architecture

| Concern     | Choice |
| ----------- | ------ |
| App         | React Router 7 (SSR) on Cloudflare Workers |
| Data        | Cloudflare D1 (`DB` binding), schema in `migrations/` |
| Documents   | Cloudflare R2 (`DOCS` binding) |
| Sign-in     | Cloudflare Access. Every request's JWT is verified in `app/lib/auth.server.ts` |

## First-time setup

```sh
npm install

# 1. Create the database and bucket in your Cloudflare account
npx wrangler d1 create vms-db              # copy the database_id it prints into wrangler.json
npx wrangler r2 bucket create vms-vendor-documents

# 2. Apply the schema
npx wrangler d1 migrations apply vms-db --local    # for local dev
npx wrangler d1 migrations apply vms-db --remote   # for production
```

### Cloudflare Access (required in production)

1. In Cloudflare Zero Trust, create a **self-hosted Access application** that covers the Worker's
   hostname, and add a policy for the people who may use the VMS.
2. In `wrangler.json`, set `ACCESS_TEAM_DOMAIN` (for example `yourteam.cloudflareaccess.com`)
   and `ACCESS_AUD` (the application's Audience tag).

If these are not set, the deployed app refuses every request. It never runs without an identity.

## Local development

```sh
npm run dev
```

Locally you are signed in as `dev.user@localhost`. To act as a second person, for example to
approve an assessment you submitted, set a cookie in the browser console:
`document.cookie = "vms_dev_user=qa.manager@hospital.example; path=/"`. This only works in dev.

## Deploy

```sh
npm run deploy
```
