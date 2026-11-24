-- Vendor onboarding and qualification (GCP / ICH E6(R3) service-provider oversight)
-- All timestamps are ISO-8601 UTC strings. All dates are YYYY-MM-DD.

CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  service_category TEXT NOT NULL,
  services_description TEXT,
  criticality TEXT NOT NULL CHECK (criticality IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'qualified', 'conditionally_qualified', 'disqualified')),
  address TEXT,
  country TEXT,
  website TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  qualified_on TEXT,
  next_requalification_date TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_requal ON vendors(next_requalification_date);

-- Documents are versioned. A new version supersedes the previous one; nothing is deleted.
CREATE TABLE vendor_documents (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  issued_on TEXT,
  expires_on TEXT,
  notes TEXT,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  superseded_at TEXT,
  superseded_by_id TEXT,
  UNIQUE (vendor_id, doc_type, version)
);
CREATE INDEX idx_docs_vendor ON vendor_documents(vendor_id, doc_type);
CREATE INDEX idx_docs_expiry ON vendor_documents(expires_on) WHERE superseded_at IS NULL;

CREATE TABLE qualification_assessments (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  kind TEXT NOT NULL CHECK (kind IN ('initial', 'requalification')),
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'decided')),
  answers_json TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  recommended_outcome TEXT NOT NULL,
  assessor_comments TEXT,
  assessor_email TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  outcome TEXT CHECK (outcome IN ('qualified', 'conditionally_qualified', 'disqualified')),
  conditions TEXT,
  decision_reason TEXT,
  approver_email TEXT,
  signature_meaning TEXT,
  decided_at TEXT
);
CREATE INDEX idx_assess_vendor ON qualification_assessments(vendor_id, submitted_at);

-- Append-only audit trail: who, what, when, why, old and new values.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  vendor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT
);
CREATE INDEX idx_audit_vendor ON audit_log(vendor_id, id);

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
