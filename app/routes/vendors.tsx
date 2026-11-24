import { Form, Link } from "react-router";
import type { Route } from "./+types/vendors";
import { requireUser } from "~/lib/auth.server";
import { listVendors, today } from "~/lib/db.server";
import { CRITICALITY, VENDOR_STATUS } from "~/lib/constants";
import { Pill, StatusBadge, inputClass, secondaryButtonClass } from "~/components/ui";

export function meta() {
	return [{ title: "Vendors · Hospital VMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	await requireUser(request, context);
	const url = new URL(request.url);
	const filters = {
		status: url.searchParams.get("status") || undefined,
		criticality: url.searchParams.get("criticality") || undefined,
		q: url.searchParams.get("q") || undefined,
	};
	const vendors = await listVendors(context.cloudflare.env.DB, filters);
	return { vendors, filters, today: today() };
}

export default function Vendors({ loaderData }: Route.ComponentProps) {
	const { vendors, filters, today } = loaderData;
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Vendors</h1>
				<Link to="/vendors/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
					Onboard vendor
				</Link>
			</div>

			<Form method="get" className="flex flex-wrap items-end gap-3">
				<input name="q" defaultValue={filters.q} placeholder="Search name or service" className={`${inputClass} max-w-xs`} />
				<select name="status" defaultValue={filters.status ?? ""} className={`${inputClass} w-auto`}>
					<option value="">All statuses</option>
					{Object.entries(VENDOR_STATUS).map(([k, v]) => (
						<option key={k} value={k}>
							{v.label}
						</option>
					))}
				</select>
				<select name="criticality" defaultValue={filters.criticality ?? ""} className={`${inputClass} w-auto`}>
					<option value="">All criticality</option>
					{Object.entries(CRITICALITY).map(([k, v]) => (
						<option key={k} value={k}>
							{v.label}
						</option>
					))}
				</select>
				<button className={secondaryButtonClass}>Filter</button>
			</Form>

			<div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
				<table className="min-w-full text-sm">
					<thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50">
						<tr>
							<th className="px-4 py-3">Vendor</th>
							<th className="px-4 py-3">Service</th>
							<th className="px-4 py-3">Criticality</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Next requalification</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
						{vendors.length === 0 && (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-center text-gray-500">
									No vendors found.
								</td>
							</tr>
						)}
						{vendors.map((v) => (
							<tr key={v.id}>
								<td className="px-4 py-3">
									<Link to={`/vendors/${v.id}`} className="font-medium text-blue-600 hover:underline">
										{v.legal_name}
									</Link>
									{v.trading_name && <div className="text-xs text-gray-500">{v.trading_name}</div>}
								</td>
								<td className="px-4 py-3">{v.service_category}</td>
								<td className="px-4 py-3">
									<Pill tone={v.criticality === "high" ? "red" : v.criticality === "medium" ? "amber" : "gray"}>
										{CRITICALITY[v.criticality].label}
									</Pill>
								</td>
								<td className="px-4 py-3">
									<StatusBadge status={v.status} />
								</td>
								<td className="px-4 py-3">
									{v.next_requalification_date ? (
										<span className={v.next_requalification_date < today ? "font-medium text-red-600" : ""}>
											{v.next_requalification_date}
										</span>
									) : (
										"—"
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
