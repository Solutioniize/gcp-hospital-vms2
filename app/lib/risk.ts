import type { Criticality, Outcome } from "./constants";

export type Answer = "yes" | "partial" | "no" | "na";

export const QUESTIONS: {
	id: string;
	text: string;
	/** true when a "yes" answer increases risk */
	adverse?: boolean;
	weight: number;
}[] = [
	{ id: "qms", text: "Has a documented quality management system (e.g. ISO 9001 or equivalent).", weight: 3 },
	{ id: "sops", text: "Has controlled SOPs covering the services to be provided.", weight: 3 },
	{ id: "gcp_training", text: "Staff GCP training is documented and current.", weight: 3 },
	{ id: "csv", text: "Computerised systems used for trial data are validated.", weight: 3 },
	{ id: "data_integrity", text: "Systems have audit trails and data integrity controls (ALCOA+).", weight: 3 },
	{ id: "capa", text: "Has a deviation and CAPA process.", weight: 2 },
	{ id: "bcp", text: "Has a business continuity / disaster recovery plan.", weight: 2 },
	{ id: "privacy", text: "Complies with applicable data protection law (e.g. GDPR, HIPAA).", weight: 2 },
	{
		id: "findings",
		text: "Has had critical regulatory inspection or audit findings in the last 3 years.",
		adverse: true,
		weight: 3,
	},
	{
		id: "subcontractors",
		text: "Subcontracts trial-related activities to third parties.",
		adverse: true,
		weight: 1,
	},
];

const POINTS: Record<Answer, number> = { yes: 0, partial: 1, no: 2, na: 0 };
const ADVERSE_POINTS: Record<Answer, number> = { yes: 2, partial: 1, no: 0, na: 0 };

export function scoreAssessment(answers: Record<string, Answer>, criticality: Criticality) {
	let points = 0;
	let max = 0;
	for (const q of QUESTIONS) {
		const a = answers[q.id];
		if (!a || a === "na") continue;
		points += (q.adverse ? ADVERSE_POINTS[a] : POINTS[a]) * q.weight;
		max += 2 * q.weight;
	}
	const score = max === 0 ? 0 : Math.round((points / max) * 100);
	// Higher criticality vendors get a stricter threshold.
	const thresholds = { high: [15, 40], medium: [25, 50], low: [35, 60] }[criticality];
	const level: "low" | "medium" | "high" =
		score <= thresholds[0] ? "low" : score <= thresholds[1] ? "medium" : "high";
	const recommended: Outcome =
		level === "low" ? "qualified" : level === "medium" ? "conditionally_qualified" : "disqualified";
	return { score, level, recommended };
}
