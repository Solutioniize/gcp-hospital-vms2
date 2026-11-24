import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/vendor.qualification";
import { requireUser } from "~/lib/auth.server";
import {
	decideAssessment,
	getVendor,
	listAssessments,
	listDocuments,
	requiredDocStatus,
	submitAssessment,
} from "~/lib/db.server";
import { str } from "~/lib/forms.server";
import { OUTCOMES, SIGNATURE_MEANING, type Outcome } from "~/lib/constants";
import { QUESTIONS, scoreAssessment, type Answer } from "~/lib/risk";
import { Card, ErrorBanner, Field, Pill, buttonClass, formatDateTime, inputClass, riskTone } from "~/components/ui";

export async function loader({ request, context, params }: Route.LoaderArgs) {
	const user = await requireUser(request, context);
	const db = context.cloudflare.env.DB;
	const vendor = await getVendor(db, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });
	const [docs, assessments] = await Promise.all([listDocuments(db, vendor.id), listAssessments(db, vendor.id)]);
	return {
		vendor,
		user,
		required: requiredDocStatus(vendor.criticality, docs),
		assessments,
		pending: assessments.find((a) => a.status === "pending_approval") ?? null,
	};
}

const ANSWERS: { value: Answer; label: string }[] = [
	{ value: "yes", label: "Yes" },
	{ value: "partial", label: "Partly" },
	{ value: "no", label: "No" },
	{ value: "na", label: "N/A" },
];

export async function action({ request, context, params }: Route.ActionArgs) {
	const user = await requireUser(request, context);
	const db = context.cloudflare.env.DB;
	const vendor = await getVendor(db, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });
	const assessments = await listAssessments(db, vendor.id);
	const pending = assessments.find((a) => a.status === "pending_approval");
	const form = await request.formData();
	const intent = str(form, "intent");

	if (intent === "submit") {
		if (pending) return { error: "An assessment is already waiting for a decision." };
		const answers: Record<string, Answer> = {};
		for (const q of QUESTIONS) {
			const a = str(form, `q_${q.id}`) as Answer | null;
			if (!a || !ANSWERS.some((x) => x.value === a)) return { error: "Answer every question." };
			answers[q.id] = a;
		}
		const { score, level, recommended } = scoreAssessment(answers, vendor.criticality);
		await submitAssessment(db, vendor, {
			answers_json: JSON.stringify(answers),
			risk_score: score,
			risk_level: level,
			recommended_outcome: recommended,
			assessor_comments: str(form, "assessor_comments"),
			assessor_email: user.email,
		});
		return { error: null };
	}

	if (intent === "decide") {
		if (!pending || pending.id !== str(form, "assessment_id"))
			return { error: "This assessment is no longer waiting for a decision. Reload the page." };
		if (pending.assessor_email === user.email)
			return { error: "The person who submitted the assessment cannot approve it. Ask another reviewer." };
		const outcome = str(form, "outcome") as Outcome | null;
		if (!outcome || !(outcome in OUTCOMES)) return { error: "Choose an outcome." };
		const reason = str(form, "reason");
		if (!reason) return { error: "Give the reason for the decision." };
		const conditions = str(form, "conditions");
		if (outcome === "conditionally_qualified" && !conditions)
			return { error: "List the conditions for conditional qualification." };
		if (outcome === "qualified") {
			const gaps = requiredDocStatus(vendor.criticality, await listDocuments(db, vendor.id)).filter(
				(r) => r.status === "missing" || r.status === "expired",
			);
			if (gaps.length)
				return {
					error: `Cannot fully qualify while required documents are missing or expired (${gaps
						.map((g) => g.label)
						.join(", ")}). Upload them or choose conditional qualification.`,
				};
		}
		if ((str(form, "confirm_email") ?? "").toLowerCase() !== user.email.toLowerCase())
			return { error: "To sign, type your own sign-in email exactly." };
		if (form.get("signature_ack") !== "on") return { error: "Confirm the meaning of your signature." };
		await decideAssessment(db, vendor, pending, {
			outcome,
			conditions,
			reason,
			approver: user.email,
			meaning: SIGNATURE_MEANING,
		});
		return { error: null };
	}

	return { error: "Unknown action." };
}

export default function Qualification({ loaderData, actionData }: Route.ComponentProps) {
	const { vendor, user, required, assessments, pending } = loaderData;
	const busy = useNavigation().state === "submitting";
	const gaps = required.filter((r) => r.status === "missing" || r.status === "expired");

	return (
		<div className="space-y-6">
			<ErrorBanner message={actionData?.error} />

			{gaps.length > 0 && (
				<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
					{gaps.length} required document{gaps.length > 1 ? "s are" : " is"} missing or expired:{" "}
					{gaps.map((g) => g.label).join(", ")}. The vendor can only be conditionally qualified until they are{" "}
					<Link to="../documents" relative="path" className="underline">
						uploaded
					</Link>
					.
				</div>
			)}

			{pending ? (
				<Card title="Assessment awaiting decision">
					<AssessmentSummary a={pending} />
					{pending.assessor_email === user.email ? (
						<p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
							You submitted this assessment. A different person must review and sign the decision (segregation of
							duties).
						</p>
					) : (
						<Form method="post" className="mt-6 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
							<input type="hidden" name="intent" value="decide" />
							<input type="hidden" name="assessment_id" value={pending.id} />
							<Field label="Decision *">
								<select name="outcome" required defaultValue={pending.recommended_outcome} className={inputClass}>
									{Object.entries(OUTCOMES).map(([k, v]) => (
										<option key={k} value={k}>
											{v}
										</option>
									))}
								</select>
							</Field>
							<Field label="Conditions" hint="Required for conditional qualification (e.g. CAPA due dates, audit within 6 months).">
								<textarea name="conditions" rows={2} className={inputClass} />
							</Field>
							<Field label="Reason for decision *">
								<textarea name="reason" rows={2} required className={inputClass} />
							</Field>
							<fieldset className="space-y-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
								<legend className="px-1 text-sm font-semibold">Electronic signature</legend>
								<Field label="Type your sign-in email to sign *" hint={`Signing as ${user.email}`}>
									<input name="confirm_email" required autoComplete="off" className={inputClass} />
								</Field>
								<label className="flex gap-2 text-sm">
									<input type="checkbox" name="signature_ack" required />
									<span>{SIGNATURE_MEANING}</span>
								</label>
							</fieldset>
							<button className={buttonClass} disabled={busy}>
								Sign and record decision
							</button>
						</Form>
					)}
				</Card>
			) : (
				<Card title={vendor.qualified_on ? "Start requalification assessment" : "Qualification risk assessment"}>
					<Form method="post" className="space-y-4">
						<input type="hidden" name="intent" value="submit" />
						<p className="text-sm text-gray-600 dark:text-gray-400">
							Answer each question from the vendor's questionnaire, documents and any audit. The risk score uses the
							vendor's {vendor.criticality} criticality. Submitting sends it to a second person for approval.
						</p>
						<ol className="space-y-3">
							{QUESTIONS.map((q, i) => (
								<li key={q.id} className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
									<span className="text-sm">
										{i + 1}. {q.text}
									</span>
									<span className="flex shrink-0 gap-3">
										{ANSWERS.map((a) => (
											<label key={a.value} className="flex items-center gap-1 text-sm">
												<input type="radio" name={`q_${q.id}`} value={a.value} required />
												{a.label}
											</label>
										))}
									</span>
								</li>
							))}
						</ol>
						<Field label="Assessor comments">
							<textarea name="assessor_comments" rows={3} className={inputClass} />
						</Field>
						<button className={buttonClass} disabled={busy}>
							Submit for approval
						</button>
					</Form>
				</Card>
			)}

			<Card title="Qualification history">
				{assessments.filter((a) => a.status === "decided").length === 0 ? (
					<p className="text-sm text-gray-500">No decisions recorded yet.</p>
				) : (
					<ul className="space-y-4">
						{assessments
							.filter((a) => a.status === "decided")
							.map((a) => (
								<li key={a.id} className="rounded-md border border-gray-100 p-4 dark:border-gray-800">
									<AssessmentSummary a={a} />
								</li>
							))}
					</ul>
				)}
			</Card>
		</div>
	);
}

function AssessmentSummary({ a }: { a: Route.ComponentProps["loaderData"]["assessments"][number] }) {
	const answers = JSON.parse(a.answers_json) as Record<string, Answer>;
	return (
		<div className="space-y-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Pill tone="blue">{a.kind === "initial" ? "Initial qualification" : "Requalification"}</Pill>
				<Pill tone={riskTone(a.risk_level)}>
					Risk {a.risk_level} ({a.risk_score}/100)
				</Pill>
				<span className="text-gray-500">Recommended: {OUTCOMES[a.recommended_outcome]}</span>
			</div>
			<p className="text-gray-600 dark:text-gray-400">
				Assessed by {a.assessor_email} on {formatDateTime(a.submitted_at)}
			</p>
			{a.assessor_comments && <p className="whitespace-pre-wrap">{a.assessor_comments}</p>}
			<details>
				<summary className="cursor-pointer text-gray-500">Answers</summary>
				<ul className="mt-2 space-y-1">
					{QUESTIONS.map((q) => (
						<li key={q.id} className="flex justify-between gap-4">
							<span>{q.text}</span>
							<span className="font-medium uppercase">{answers[q.id]}</span>
						</li>
					))}
				</ul>
			</details>
			{a.status === "decided" && a.outcome && (
				<div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800/50">
					<p className="font-medium">Decision: {OUTCOMES[a.outcome]}</p>
					{a.conditions && <p className="mt-1 whitespace-pre-wrap">Conditions: {a.conditions}</p>}
					<p className="mt-1 whitespace-pre-wrap">Reason: {a.decision_reason}</p>
					<p className="mt-2 text-xs text-gray-500">
						Signed electronically by {a.approver_email} on {formatDateTime(a.decided_at)}. Meaning: “{a.signature_meaning}”
					</p>
				</div>
			)}
		</div>
	);
}
