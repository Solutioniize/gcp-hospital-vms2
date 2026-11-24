import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/vendor.overview";
import { requireUser } from "~/lib/auth.server";
import { getVendor, updateVendor } from "~/lib/db.server";
import { parseVendorForm, str } from "~/lib/forms.server";
import { CRITICALITY } from "~/lib/constants";
import { VendorFields } from "~/components/vendor-form";
import { Card, ErrorBanner, Field, buttonClass, formatDateTime, inputClass, secondaryButtonClass } from "~/components/ui";

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireUser(request, context);
	const vendor = await getVendor(context.cloudflare.env.DB, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });
	return { vendor };
}

export async function action({ request, context, params }: Route.ActionArgs) {
	const user = await requireUser(request, context);
	const db = context.cloudflare.env.DB;
	const vendor = await getVendor(db, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });
	const form = await request.formData();
	const { input, errors, ok } = parseVendorForm(form);
	const reason = str(form, "reason");
	if (!ok) return { errors, values: input, error: null as string | null, saved: false };
	if (!reason) return { errors, values: input, error: "Give a reason for the change. It is recorded in the audit trail.", saved: false };
	const changed = await updateVendor(db, vendor, input, user.email, reason);
	return { errors: {}, values: null, error: changed ? null : "Nothing was changed.", saved: changed };
}

export default function Overview({ loaderData, actionData }: Route.ComponentProps) {
	const { vendor } = loaderData;
	const [editing, setEditing] = useState(false);
	const busy = useNavigation().state === "submitting";
	const showForm = editing || (actionData && !actionData.saved);

	if (showForm) {
		return (
			<Card title="Edit vendor details">
				<Form method="post" className="space-y-6" onSubmit={() => setEditing(false)}>
					<ErrorBanner message={actionData?.error} />
					<VendorFields values={actionData?.values ?? vendor} errors={actionData?.errors} />
					<Field label="Reason for change *" hint="Required for the audit trail (who, what, when, why).">
						<input name="reason" required className={inputClass} />
					</Field>
					<div className="flex gap-3">
						<button className={buttonClass} disabled={busy}>
							Save changes
						</button>
						<a href="." className={secondaryButtonClass}>
							Cancel
						</a>
					</div>
				</Form>
			</Card>
		);
	}

	const rows: [string, string | null][] = [
		["Legal name", vendor.legal_name],
		["Trading name", vendor.trading_name],
		["Service category", vendor.service_category],
		["Services provided", vendor.services_description],
		["Criticality", `${CRITICALITY[vendor.criticality].label} (requalify every ${CRITICALITY[vendor.criticality].requalifyMonths} months)`],
		["Qualified on", vendor.qualified_on],
		["Next requalification", vendor.next_requalification_date],
		["Contact", [vendor.contact_name, vendor.contact_email, vendor.contact_phone].filter(Boolean).join(" · ") || null],
		["Address", [vendor.address, vendor.country].filter(Boolean).join(", ") || null],
		["Website", vendor.website],
		["Created", `${formatDateTime(vendor.created_at)} by ${vendor.created_by}`],
		["Last updated", `${formatDateTime(vendor.updated_at)} by ${vendor.updated_by}`],
	];

	return (
		<Card
			title="Vendor details"
			actions={
				<button className={secondaryButtonClass} onClick={() => setEditing(true)}>
					Edit
				</button>
			}
		>
			{actionData?.saved && <p className="mb-4 text-sm text-green-700">Changes saved and recorded in the audit trail.</p>}
			<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[200px_1fr]">
				{rows.map(([k, v]) => (
					<div key={k} className="contents">
						<dt className="text-gray-500">{k}</dt>
						<dd className="whitespace-pre-wrap">{v || "—"}</dd>
					</div>
				))}
			</dl>
		</Card>
	);
}
