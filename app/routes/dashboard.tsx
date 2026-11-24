import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth.server";
import { dashboardData } from "~/lib/db.server";
import { DOC_TYPES, VENDOR_STATUS, type VendorStatus } from "~/lib/constants";
import { Card, Pill, StatusBadge, formatDateTime, riskTone } from "~/components/ui";

export function meta() {
	return [{ title: "Dashboard · Hospital VMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	await requireUser(request, context);
	return dashboardData(context.cloudflare.env.DB);
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
	const { counts, expiringDocs, requalification, pending, today } = loaderData;
	const count = (s: VendorStatus) => counts.find((c) => c.status === s)?.n ?? 0;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Vendor qualification dashboard</h1>
				<Link to="/vendors/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
					Onboard vendor
				</Link>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				{(Object.keys(VENDOR_STATUS) as VendorStatus[]).map((s) => (
					<Link
						key={s}
						to={`/vendors?status=${s}`}
						className="rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-400 dark:border-gray-800 dark:bg-gray-900"
					>
						<div className="text-2xl font-semibold">{count(s)}</div>
						<div className="mt-1 text-xs text-gray-500">{VENDOR_STATUS[s].label}</div>
					</Link>
				))}
			</div>

			<Card title="Awaiting qualification decision">
				{pending.length === 0 ? (
					<p className="text-sm text-gray-500">No assessments are waiting for approval.</p>
				) : (
					<ul className="divide-y divide-gray-100 dark:divide-gray-800">
						{pending.map((a) => (
							<li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
								<Link to={`/vendors/${a.vendor_id}/qualification`} className="font-medium text-blue-600 hover:underline">
									{a.legal_name}
								</Link>
								<span className="flex items-center gap-2 text-gray-500">
									<Pill tone={riskTone(a.risk_level)}>Risk {a.risk_level}</Pill>
									submitted {formatDateTime(a.submitted_at)} by {a.assessor_email}
								</span>
							</li>
						))}
					</ul>
				)}
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Documents expired or expiring within 2 months">
					{expiringDocs.length === 0 ? (
						<p className="text-sm text-gray-500">Nothing is expiring soon.</p>
					) : (
						<ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
							{expiringDocs.map((d) => (
								<li key={d.id} className="flex items-center justify-between gap-2 py-2">
									<span>
										<Link to={`/vendors/${d.vendor_id}/documents`} className="font-medium text-blue-600 hover:underline">
											{d.legal_name}
										</Link>
										<span className="block text-xs text-gray-500">{DOC_TYPES[d.doc_type]?.label ?? d.doc_type}</span>
									</span>
									<Pill tone={d.expires_on! < today ? "red" : "amber"}>
										{d.expires_on! < today ? "Expired" : "Expires"} {d.expires_on}
									</Pill>
								</li>
							))}
						</ul>
					)}
				</Card>

				<Card title="Requalification due within 2 months">
					{requalification.length === 0 ? (
						<p className="text-sm text-gray-500">No requalifications due soon.</p>
					) : (
						<ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
							{requalification.map((v) => (
								<li key={v.id} className="flex items-center justify-between gap-2 py-2">
									<span className="flex items-center gap-2">
										<Link to={`/vendors/${v.id}/qualification`} className="font-medium text-blue-600 hover:underline">
											{v.legal_name}
										</Link>
										<StatusBadge status={v.status} />
									</span>
									<Pill tone={v.next_requalification_date! < today ? "red" : "amber"}>
										{v.next_requalification_date! < today ? "Overdue" : "Due"} {v.next_requalification_date}
									</Pill>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
		</div>
	);
}
