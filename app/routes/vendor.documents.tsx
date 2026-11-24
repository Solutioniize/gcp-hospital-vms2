import { Form, useNavigation } from "react-router";
import { useEffect, useRef } from "react";
import type { Route } from "./+types/vendor.documents";
import { requireUser } from "~/lib/auth.server";
import { addDocument, getVendor, listDocuments, requiredDocStatus, today } from "~/lib/db.server";
import { str } from "~/lib/forms.server";
import { DOC_TYPES, MAX_UPLOAD_BYTES, isDocType } from "~/lib/constants";
import {
	Card,
	ErrorBanner,
	Field,
	Pill,
	buttonClass,
	formatBytes,
	formatDateTime,
	inputClass,
} from "~/components/ui";

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireUser(request, context);
	const db = context.cloudflare.env.DB;
	const vendor = await getVendor(db, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });
	const docs = await listDocuments(db, vendor.id);
	return { vendor, docs, required: requiredDocStatus(vendor.criticality, docs), today: today() };
}

async function sha256Hex(buf: ArrayBuffer) {
	const hash = await crypto.subtle.digest("SHA-256", buf);
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function action({ request, context, params }: Route.ActionArgs) {
	const user = await requireUser(request, context);
	const { DB, DOCS } = context.cloudflare.env;
	const vendor = await getVendor(DB, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });

	const form = await request.formData();
	const file = form.get("file");
	const docType = str(form, "doc_type") ?? "";
	const expiresOn = str(form, "expires_on");
	const issuedOn = str(form, "issued_on");

	if (!isDocType(docType)) return { error: "Choose a document type.", ok: false };
	if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload.", ok: false };
	if (file.size > MAX_UPLOAD_BYTES) return { error: `Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`, ok: false };
	if (DOC_TYPES[docType].expires && !expiresOn)
		return { error: `${DOC_TYPES[docType].label} needs an expiry date.`, ok: false };
	if (issuedOn && expiresOn && expiresOn < issuedOn)
		return { error: "The expiry date is before the issue date.", ok: false };

	const buf = await file.arrayBuffer();
	const sha256 = await sha256Hex(buf);
	const id = crypto.randomUUID();
	const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "document";
	const r2Key = `vendors/${vendor.id}/documents/${id}/${safeName}`;
	const contentType = file.type || "application/octet-stream";

	await DOCS.put(r2Key, buf, {
		httpMetadata: { contentType },
		customMetadata: { sha256, uploadedBy: user.email, vendorId: vendor.id, docType },
		sha256,
	});

	await addDocument(
		DB,
		{
			id,
			vendor_id: vendor.id,
			doc_type: docType,
			title: str(form, "title") ?? DOC_TYPES[docType].label,
			file_name: safeName,
			content_type: contentType,
			size_bytes: file.size,
			sha256,
			r2_key: r2Key,
			issued_on: issuedOn,
			expires_on: expiresOn,
			notes: str(form, "notes"),
			uploaded_by: user.email,
		},
		str(form, "reason"),
	);
	return { error: null, ok: true };
}

const STATUS_PILL = {
	missing: <Pill tone="red">Missing</Pill>,
	expired: <Pill tone="red">Expired</Pill>,
	expiring: <Pill tone="amber">Expiring soon</Pill>,
	current: <Pill tone="green">Current</Pill>,
};

export default function Documents({ loaderData, actionData }: Route.ComponentProps) {
	const { vendor, docs, required, today } = loaderData;
	const nav = useNavigation();
	const busy = nav.state === "submitting";
	const formRef = useRef<HTMLFormElement>(null);
	useEffect(() => {
		if (actionData?.ok) formRef.current?.reset();
	}, [actionData]);

	return (
		<div className="space-y-6">
			<Card title={`Required documents for ${vendor.criticality} criticality`}>
				<ul className="grid gap-2 sm:grid-cols-2">
					{required.map((r) => (
						<li key={r.type} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm dark:border-gray-800">
							<span>
								{r.label}
								{r.doc?.expires_on && <span className="block text-xs text-gray-500">Expires {r.doc.expires_on}</span>}
							</span>
							{STATUS_PILL[r.status]}
						</li>
					))}
				</ul>
			</Card>

			<Card title="Upload a document">
				<Form method="post" encType="multipart/form-data" ref={formRef} className="space-y-4">
					<ErrorBanner message={actionData?.error} />
					{actionData?.ok && <p className="text-sm text-green-700">Document uploaded and recorded in the audit trail.</p>}
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Document type *">
							<select name="doc_type" required className={inputClass} defaultValue="">
								<option value="">Choose…</option>
								{Object.entries(DOC_TYPES).map(([k, d]) => (
									<option key={k} value={k}>
										{d.label}
									</option>
								))}
							</select>
						</Field>
						<Field label="Title" hint="Defaults to the document type.">
							<input name="title" className={inputClass} />
						</Field>
						<Field label="Issue / effective date">
							<input type="date" name="issued_on" className={inputClass} />
						</Field>
						<Field label="Expiry date" hint="Required for agreements, certificates, training and insurance.">
							<input type="date" name="expires_on" className={inputClass} />
						</Field>
						<Field label="File *" hint={`PDF or scanned document, up to ${formatBytes(MAX_UPLOAD_BYTES)}.`}>
							<input type="file" name="file" required className="block w-full text-sm" />
						</Field>
						<Field label="Reason (when replacing a version)">
							<input name="reason" className={inputClass} placeholder="e.g. Annual renewal" />
						</Field>
					</div>
					<Field label="Notes">
						<textarea name="notes" rows={2} className={inputClass} />
					</Field>
					<button className={buttonClass} disabled={busy}>
						{busy ? "Uploading…" : "Upload"}
					</button>
				</Form>
			</Card>

			<Card title="All documents and versions">
				{docs.length === 0 ? (
					<p className="text-sm text-gray-500">No documents uploaded yet.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="text-left text-xs uppercase text-gray-500">
								<tr>
									<th className="py-2 pr-4">Document</th>
									<th className="py-2 pr-4">Version</th>
									<th className="py-2 pr-4">Expiry</th>
									<th className="py-2 pr-4">Uploaded</th>
									<th className="py-2 pr-4">SHA-256</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
								{docs.map((d) => (
									<tr key={d.id} className={d.superseded_at ? "text-gray-400" : ""}>
										<td className="py-2 pr-4">
											<a href={`/vendors/${vendor.id}/documents/${d.id}/file`} className="font-medium text-blue-600 hover:underline">
												{d.title}
											</a>
											<div className="text-xs text-gray-500">
												{DOC_TYPES[d.doc_type]?.label} · {d.file_name} · {formatBytes(d.size_bytes)}
											</div>
										</td>
										<td className="py-2 pr-4">
											v{d.version} {d.superseded_at ? <Pill>Superseded</Pill> : <Pill tone="green">Current</Pill>}
										</td>
										<td className="py-2 pr-4">
											{d.expires_on ? (
												<span className={!d.superseded_at && d.expires_on < today ? "font-medium text-red-600" : ""}>
													{d.expires_on}
												</span>
											) : (
												"—"
											)}
										</td>
										<td className="py-2 pr-4 text-xs">
											{formatDateTime(d.uploaded_at)}
											<div className="text-gray-500">{d.uploaded_by}</div>
										</td>
										<td className="py-2 pr-4 font-mono text-xs" title={d.sha256}>
											{d.sha256.slice(0, 12)}…
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</div>
	);
}
