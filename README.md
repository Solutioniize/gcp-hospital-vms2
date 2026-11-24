# Hospital Vendor Management System — demo portal

A clickable demo of the vendor management system described in the *Workflow & Spec* document. It runs entirely in the browser with fictional sample data, and Cloudflare serves it as static files from this repository.

**Live:** https://gcp-hospital-vms2.eenableconsulting.workers.dev

## What the demo shows

| Screen | What to try |
| --- | --- |
| Sign-in | Pick a role (purchase, stores, accounts, finance, quality, CEO/MS, privacy officer). Switch roles from the top bar at any time. |
| Dashboard | Nine lifecycle stages with live counts, plus alerts: suspended vendors, MSME payments due, the privacy-incident clock, approvals waiting for you. |
| Vendor master / Vendor 360 | Documents with expiry dates, PO eligibility, score trend, profile. PAN and bank details are masked unless the role is allowed to see them. |
| Onboarding & approval | Register a vendor; the category decides which documents are mandatory; the committee scores it on a 100-point sheet (60 to empanel). |
| Purchase orders | A PO to a blocked vendor is refused and logged. Approval goes by value (₹50k / ₹5 lakh / above). Whoever raises a PO cannot approve it. |
| Goods receipt | Stores records received and rejected quantities and shelf life; late or rejected deliveries lower the vendor's score. |
| Invoices & payments | Three-way match (PO, GRN, invoice), e-invoice IRN check, MSME 45-day clock, prepare → approve → paid. |
| Scorecards | Quarterly 100-point score, bands A–D, spend share, single-source warning. |
| Renewals | T−90/60/30/15 stages, routes that depend on the band, record a renewal (a suspended vendor is reinstated automatically). |
| NABH audit pack | Monthly indicators and a printable vendor file. |
| Privacy (DPDP) | Data processor register, signed addenda, incident register with the 72-hour clock. |
| Audit trail | Every action with role and time. |

**Good demo path:** sign in as *Purchase executive* → raise a PO to OrthoLine (blocked) and then to Apex Surgicals → switch to *Purchase manager* or *Finance* to approve it → *Stores* to record the GRN → *Accounts* to enter the invoice → *Finance* to pay it.

Data is saved in the browser you use. To start again, click **Reset demo data** at the bottom of the sidebar.

## Files

```
public/            the website (served as-is)
  index.html
  css/app.css
  js/data.js       sample vendors, POs, invoices (all fictional)
  js/app.js        screens and business rules
  _headers         security headers
wrangler.jsonc     tells the Cloudflare Worker to serve ./public
package.json       no build step; wrangler for deploys
```

## Deploying

The Cloudflare Worker `gcp-hospital-vms2` is connected to this GitHub repository. Each push to `main` redeploys it within about a minute.

- Build command: `npm run build` (does nothing; there is no build step)
- Deploy command: `npx wrangler deploy`

To run it on your own computer: `npm install`, then `npx wrangler dev`, then open http://localhost:8787. You can also open `public/index.html` directly in a browser.

## Not in the demo

These are part of the real system and are left out here: user logins with MFA, a database, file uploads, email, and the Tally and HIS integrations. Everything is simulated in the browser.
