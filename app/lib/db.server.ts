import {
	CRITICALITY,
	DOC_TYPES,
	REQUIRED_DOCS,
	type Criticality,
	type DocType,
	type Outcome,
	type VendorStatus,
} from "./constants";

export type Vendor = {
	id: string;
	legal_name: string;
	trading_name: string | null;
	service_category: string;
	services_description: string | null;
	criticality: Criticality;
	status: VendorStatus;
	address: string | null;
	country: string | null;
	website: string | null;
	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
	qualified_on: string | null;
	next_requalification_date: string | null;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
};

export type VendorDocument = {
	id: string;
	vendor_id: string;
	doc_type: DocType;
	title: string;
	version: number;
	file_name: string;
	content_type: string;
	size_bytes: number;
	sha256: string;
	r2_key: string;
	issued_on: string | null;
	expires_on: string | null;
	notes: string | null;
	uploaded_at: string;
	uploaded_by: string;
	superseded_at: string | null;
	superseded_by_id: string | null;
};

export type Assessment = {
	id: string;
	vendor_id: string;
	kind: "initial" | "requalification";
	status: "pending_approval" | "decided";
	answers_json: string;
	risk_score: number;
	risk_level: "low" | "medium" | "high";
	recommended_outcome: Outcome;
	assessor_comments: string | null;
	assessor_email: string;
	submitted_at: string;
	outcome: Outcome | null;
	conditions: string | null;
	decision_reason: string | null;
	approver_email: string | null;
	signature_meaning: string | null;
	decided_at: string | null;
};

export type AuditEntry = {
	id: number;
	at: string;
	actor_email: string;
	vendor_id: string | null;
	entity_type: string;
	entity_id: string;
	action: string;
	before_json: string | null;
	after_json: string | null;
	reason: string | null;
};

export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export function addMonths(date: string, months: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() + months);
	return d.toISOString().slice(0, 10);
}

export function auditStmt(
	db: D1Database,
	e: {
		actor: string;
		vendorId: string | null;
		entityType: string;
		entityId: string;
		action: string;
		before?: unknown;
		after?: unknown;
		reason?: string | null;
		at?: string;
	},
) {
	return db
		.prepare(
			`INSERT INTO audit_log (at, actor_email, vendor_id, entity_type, entity_id, action, before_json, after_json, reason)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			e.at ?? nowIso(),
			e.actor,
			e.vendorId,
			e.entityType,
			e.entityId,
			e.action,
			e.before === undefined ? null : JSON.stringify(e.before),
			e.after === undefined ? null : JSON.stringify(e.after),
			e.reason ?? null,
		);
}

// ---------- Vendors ----------

export const EDITABLE_VENDOR_FIELDS = [
	"legal_name",
	"trading_name",
	"service_category",
	"services_description",
	"criticality",
	"address",
	"country",
	"website",
	"contact_name",
	"contact_email",
	"contact_phone",
] as const;
export type VendorInput = { [K in (typeof EDITABLE_VENDOR_FIELDS)[number]]: string | null };

export async function listVendors(
	db: D1Database,
	filters: { status?: string; criticality?: string; q?: string },
) {
	const where: string[] = [];
	const args: string[] = [];
	if (filters.status) {
		where.push("status = ?");
		args.push(filters.status);
	}
	if (filters.criticality) {
		where.push("criticality = ?");
		args.push(filters.criticality);
	}
	if (filters.q) {
		where.push("(legal_name LIKE ? OR trading_name LIKE ? OR service_category LIKE ?)");
		const like = `%${filters.q}%`;
		args.push(like, like, like);
	}
	const sql = `SELECT * FROM vendors ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY legal_name COLLATE NOCASE`;
	const { results } = await db.prepare(sql).bind(...args).all<Vendor>();
	return results;
}

export async function getVendor(db: D1Database, id: string) {
	return db.prepare("SELECT * FROM vendors WHERE id = ?").bind(id).first<Vendor>();
}

export async function createVendor(db: D1Database, input: VendorInput, actor: string) {
	const id = crypto.randomUUID();
	const at = nowIso();
	const vendor: Vendor = {
		...(input as Omit<VendorInput, "criticality">),
		legal_name: input.legal_name!,
		service_category: input.service_category!,
		criticality: input.criticality as Criticality,
		id,
		status: "draft",
		qualified_on: null,
		next_requalification_date: null,
		created_at: at,
		created_by: actor,
		updated_at: at,
		updated_by: actor,
	};
	const cols = Object.keys(vendor);
	await db.batch([
		db
			.prepare(`INSERT INTO vendors (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
			.bind(...cols.map((c) => (vendor as Record<string, unknown>)[c] ?? null)),
		auditStmt(db, {
			actor,
			at,
			vendorId: id,
			entityType: "vendor",
			entityId: id,
			action: "create",
			after: vendor,
		}),
	]);
	return id;
}

export async function updateVendor(
	db: D1Database,
	before: Vendor,
	input: VendorInput,
	actor: string,
	reason: string,
) {
	const changedBefore: Record<string, unknown> = {};
	const changedAfter: Record<string, unknown> = {};
	for (const f of EDITABLE_VENDOR_FIELDS) {
		if ((before[f] ?? null) !== (input[f] ?? null)) {
			changedBefore[f] = before[f];
			changedAfter[f] = input[f];
		}
	}
	const keys = Object.keys(changedAfter);
	if (keys.length === 0) return false;
	const at = nowIso();
	await db.batch([
		db
			.prepare(
				`UPDATE vendors SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?, updated_by = ? WHERE id = ?`,
			)
			.bind(...keys.map((k) => changedAfter[k] ?? null), at, actor, before.id),
		auditStmt(db, {
			actor,
			at,
			vendorId: before.id,
			entityType: "vendor",
			entityId: before.id,
			action: "update",
			before: changedBefore,
			after: changedAfter,
			reason,
		}),
	]);
	return true;
}

// ---------- Documents ----------

export async function listDocuments(db: D1Database, vendorId: string) {
	const { results } = await db
		.prepare("SELECT * FROM vendor_documents WHERE vendor_id = ? ORDER BY doc_type, version DESC")
		.bind(vendorId)
		.all<VendorDocument>();
	return results;
}

export async function getDocument(db: D1Database, vendorId: string, docId: string) {
	return db
		.prepare("SELECT * FROM vendor_documents WHERE id = ? AND vendor_id = ?")
		.bind(docId, vendorId)
		.first<VendorDocument>();
}

export async function addDocument(
	db: D1Database,
	doc: Omit<VendorDocument, "version" | "superseded_at" | "superseded_by_id" | "uploaded_at">,
	reason: string | null,
) {
	const current = await db
		.prepare(
			"SELECT * FROM vendor_documents WHERE vendor_id = ? AND doc_type = ? AND superseded_at IS NULL ORDER BY version DESC LIMIT 1",
		)
		.bind(doc.vendor_id, doc.doc_type)
		.first<VendorDocument>();
	const maxRow = await db
		.prepare("SELECT MAX(version) AS v FROM vendor_documents WHERE vendor_id = ? AND doc_type = ?")
		.bind(doc.vendor_id, doc.doc_type)
		.first<{ v: number | null }>();
	const at = nowIso();
	const full: VendorDocument = {
		...doc,
		version: (maxRow?.v ?? 0) + 1,
		uploaded_at: at,
		superseded_at: null,
		superseded_by_id: null,
	};
	const cols = Object.keys(full);
	const stmts = [
		db
			.prepare(
				`INSERT INTO vendor_documents (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
			)
			.bind(...cols.map((c) => (full as Record<string, unknown>)[c] ?? null)),
		auditStmt(db, {
			actor: doc.uploaded_by,
			at,
			vendorId: doc.vendor_id,
			entityType: "document",
			entityId: doc.id,
			action: current ? "new_version" : "upload",
			before: current ? { id: current.id, version: current.version, sha256: current.sha256 } : undefined,
			after: full,
			reason,
		}),
	];
	if (current) {
		stmts.push(
			db
				.prepare("UPDATE vendor_documents SET superseded_at = ?, superseded_by_id = ? WHERE id = ?")
				.bind(at, doc.id, current.id),
		);
	}
	await db.batch(stmts);
	return full;
}

export type DocStatus = "missing" | "expired" | "expiring" | "current";

/** Status of each required document type for a vendor's criticality. */
export function requiredDocStatus(criticality: Criticality, docs: VendorDocument[], asOf = today()) {
	const soon = addMonths(asOf, 2);
	return REQUIRED_DOCS[criticality].map((type) => {
		const doc = docs.find((d) => d.doc_type === type && !d.superseded_at);
		let status: DocStatus = "current";
		if (!doc) status = "missing";
		else if (doc.expires_on && doc.expires_on < asOf) status = "expired";
		else if (doc.expires_on && doc.expires_on <= soon) status = "expiring";
		return { type, label: DOC_TYPES[type].label, doc, status };
	});
}

// ---------- Assessments ----------

export async function listAssessments(db: D1Database, vendorId: string) {
	const { results } = await db
		.prepare("SELECT * FROM qualification_assessments WHERE vendor_id = ? ORDER BY submitted_at DESC")
		.bind(vendorId)
		.all<Assessment>();
	return results;
}

export async function submitAssessment(
	db: D1Database,
	vendor: Vendor,
	a: Pick<
		Assessment,
		"answers_json" | "risk_score" | "risk_level" | "recommended_outcome" | "assessor_comments" | "assessor_email"
	>,
) {
	const id = crypto.randomUUID();
	const at = nowIso();
	const kind = vendor.qualified_on ? "requalification" : "initial";
	const row = { id, vendor_id: vendor.id, kind, status: "pending_approval", submitted_at: at, ...a };
	const cols = Object.keys(row);
	await db.batch([
		db
			.prepare(
				`INSERT INTO qualification_assessments (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
			)
			.bind(...cols.map((c) => (row as Record<string, unknown>)[c] ?? null)),
		db
			.prepare("UPDATE vendors SET status = 'under_review', updated_at = ?, updated_by = ? WHERE id = ?")
			.bind(at, a.assessor_email, vendor.id),
		auditStmt(db, {
			actor: a.assessor_email,
			at,
			vendorId: vendor.id,
			entityType: "assessment",
			entityId: id,
			action: "submit",
			after: row,
		}),
		auditStmt(db, {
			actor: a.assessor_email,
			at,
			vendorId: vendor.id,
			entityType: "vendor",
			entityId: vendor.id,
			action: "status_change",
			before: { status: vendor.status },
			after: { status: "under_review" },
			reason: `Qualification assessment ${id} submitted for approval`,
		}),
	]);
	return id;
}

export async function decideAssessment(
	db: D1Database,
	vendor: Vendor,
	assessment: Assessment,
	d: { outcome: Outcome; conditions: string | null; reason: string; approver: string; meaning: string },
) {
	const at = nowIso();
	const qualifiedOn = d.outcome === "disqualified" ? vendor.qualified_on : at.slice(0, 10);
	const nextRequal =
		d.outcome === "disqualified" ? null : addMonths(at.slice(0, 10), CRITICALITY[vendor.criticality].requalifyMonths);
	const decision = {
		status: "decided",
		outcome: d.outcome,
		conditions: d.conditions,
		decision_reason: d.reason,
		approver_email: d.approver,
		signature_meaning: d.meaning,
		decided_at: at,
	};
	await db.batch([
		db
			.prepare(
				`UPDATE qualification_assessments SET status = 'decided', outcome = ?, conditions = ?, decision_reason = ?,
				 approver_email = ?, signature_meaning = ?, decided_at = ? WHERE id = ? AND status = 'pending_approval'`,
			)
			.bind(d.outcome, d.conditions, d.reason, d.approver, d.meaning, at, assessment.id),
		db
			.prepare(
				"UPDATE vendors SET status = ?, qualified_on = ?, next_requalification_date = ?, updated_at = ?, updated_by = ? WHERE id = ?",
			)
			.bind(d.outcome, qualifiedOn, nextRequal, at, d.approver, vendor.id),
		auditStmt(db, {
			actor: d.approver,
			at,
			vendorId: vendor.id,
			entityType: "assessment",
			entityId: assessment.id,
			action: "e_signature",
			before: { status: assessment.status },
			after: decision,
			reason: d.reason,
		}),
		auditStmt(db, {
			actor: d.approver,
			at,
			vendorId: vendor.id,
			entityType: "vendor",
			entityId: vendor.id,
			action: "status_change",
			before: {
				status: vendor.status,
				qualified_on: vendor.qualified_on,
				next_requalification_date: vendor.next_requalification_date,
			},
			after: { status: d.outcome, qualified_on: qualifiedOn, next_requalification_date: nextRequal },
			reason: d.reason,
		}),
	]);
}

// ---------- Audit ----------

export async function listAudit(db: D1Database, opts: { vendorId?: string; limit?: number }) {
	const limit = Math.min(opts.limit ?? 200, 1000);
	const stmt = opts.vendorId
		? db.prepare("SELECT * FROM audit_log WHERE vendor_id = ? ORDER BY id DESC LIMIT ?").bind(opts.vendorId, limit)
		: db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").bind(limit);
	const { results } = await stmt.all<AuditEntry>();
	return results;
}

// ---------- Dashboard ----------

export async function dashboardData(db: D1Database) {
	const t = today();
	const soon = addMonths(t, 2);
	const [counts, expiringDocs, requal, pending] = await db.batch([
		db.prepare("SELECT status, COUNT(*) AS n FROM vendors GROUP BY status"),
		db
			.prepare(
				`SELECT d.*, v.legal_name FROM vendor_documents d JOIN vendors v ON v.id = d.vendor_id
				 WHERE d.superseded_at IS NULL AND d.expires_on IS NOT NULL AND d.expires_on <= ?
				 AND v.status != 'disqualified' ORDER BY d.expires_on LIMIT 50`,
			)
			.bind(soon),
		db
			.prepare(
				`SELECT * FROM vendors WHERE next_requalification_date IS NOT NULL AND next_requalification_date <= ?
				 AND status IN ('qualified', 'conditionally_qualified') ORDER BY next_requalification_date LIMIT 50`,
			)
			.bind(soon),
		db.prepare(
			`SELECT a.*, v.legal_name FROM qualification_assessments a JOIN vendors v ON v.id = a.vendor_id
			 WHERE a.status = 'pending_approval' ORDER BY a.submitted_at`,
		),
	]);
	return {
		today: t,
		counts: counts.results as { status: VendorStatus; n: number }[],
		expiringDocs: expiringDocs.results as (VendorDocument & { legal_name: string })[],
		requalification: requal.results as Vendor[],
		pending: pending.results as (Assessment & { legal_name: string })[],
	};
}
