export const SERVICE_CATEGORIES = [
	"Contract research organisation (CRO)",
	"Central laboratory",
	"Bioanalytical laboratory",
	"Imaging core lab",
	"IRT / RTSM",
	"EDC / data management",
	"eCOA / ePRO",
	"Pharmacovigilance / safety",
	"Clinical supplies / depot",
	"Courier / logistics",
	"Site management organisation (SMO)",
	"Translation services",
	"Other",
] as const;

export type Criticality = "high" | "medium" | "low";

export const CRITICALITY: Record<
	Criticality,
	{ label: string; help: string; requalifyMonths: number }
> = {
	high: {
		label: "High",
		help: "Directly affects participant safety or reliability of trial results (e.g. CRO, central lab, IRT).",
		requalifyMonths: 12,
	},
	medium: {
		label: "Medium",
		help: "Supports trial-related activities with indirect impact on data or safety.",
		requalifyMonths: 24,
	},
	low: {
		label: "Low",
		help: "Limited impact on participant safety or trial data (e.g. translation, general logistics).",
		requalifyMonths: 36,
	},
};

export type VendorStatus =
	| "draft"
	| "under_review"
	| "qualified"
	| "conditionally_qualified"
	| "disqualified";

export const VENDOR_STATUS: Record<VendorStatus, { label: string; tone: string }> = {
	draft: { label: "Draft", tone: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
	under_review: { label: "Under review", tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" },
	qualified: { label: "Qualified", tone: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200" },
	conditionally_qualified: {
		label: "Conditionally qualified",
		tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
	},
	disqualified: { label: "Disqualified", tone: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200" },
};

export const DOC_TYPES = {
	quality_agreement: { label: "Quality agreement", expires: true },
	cda: { label: "Confidentiality agreement (CDA)", expires: true },
	audit_report: { label: "Vendor audit report", expires: false },
	sop_index: { label: "SOP index", expires: false },
	gcp_training: { label: "GCP training records", expires: true },
	iso_certificate: { label: "ISO / accreditation certificate", expires: true },
	insurance: { label: "Insurance certificate", expires: true },
	validation_summary: { label: "Computerised system validation summary", expires: false },
	data_protection: { label: "Data protection agreement", expires: true },
	other: { label: "Other", expires: false },
} as const;

export type DocType = keyof typeof DOC_TYPES;

export function isDocType(v: string): v is DocType {
	return Object.prototype.hasOwnProperty.call(DOC_TYPES, v);
}

/** Documents that must be current before a vendor can be fully qualified. */
export const REQUIRED_DOCS: Record<Criticality, DocType[]> = {
	high: ["quality_agreement", "cda", "audit_report", "sop_index", "gcp_training", "insurance"],
	medium: ["quality_agreement", "cda", "sop_index", "insurance"],
	low: ["cda", "insurance"],
};

export const OUTCOMES = {
	qualified: "Qualified",
	conditionally_qualified: "Conditionally qualified",
	disqualified: "Disqualified",
} as const;
export type Outcome = keyof typeof OUTCOMES;

export const SIGNATURE_MEANING =
	"I approve this qualification decision and confirm it is based on the documented assessment.";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
