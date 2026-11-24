import { Link } from "react-router";
import { formatDateTime } from "./ui";

type Entry = {
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
	legal_name?: string | null;
};

function Diff({ before, after }: { before: string | null; after: string | null }) {
	const b = before ? (JSON.parse(before) as Record<string, unknown>) : {};
	const a = after ? (JSON.parse(after) as Record<string, unknown>) : {};
	const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
	if (!keys.length) return null;
	const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
	return (
		<details className="mt-1">
			<summary className="cursor-pointer text-xs text-gray-500">{keys.length} field(s)</summary>
			<table className="mt-1 text-xs">
				<tbody>
					{keys.map((k) => (
						<tr key={k} className="align-top">
							<td className="pr-3 font-mono text-gray-500">{k}</td>
							{before && <td className="pr-3 text-red-700 line-through dark:text-red-400">{fmt(b[k])}</td>}
							<td className="text-green-700 dark:text-green-400">{fmt(a[k])}</td>
						</tr>
					))}
				</tbody>
			</table>
		</details>
	);
}

export function AuditTable({ entries, showVendor }: { entries: Entry[]; showVendor?: boolean }) {
	if (!entries.length) return <p className="text-sm text-gray-500">No audit entries yet.</p>;
	return (
		<div className="overflow-x-auto">
			<table className="min-w-full text-sm">
				<thead className="text-left text-xs uppercase text-gray-500">
					<tr>
						<th className="py-2 pr-4">When (UTC)</th>
						<th className="py-2 pr-4">Who</th>
						{showVendor && <th className="py-2 pr-4">Vendor</th>}
						<th className="py-2 pr-4">What</th>
						<th className="py-2 pr-4">Why</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
					{entries.map((e) => (
						<tr key={e.id} className="align-top">
							<td className="whitespace-nowrap py-2 pr-4 text-xs">{formatDateTime(e.at)}</td>
							<td className="py-2 pr-4 text-xs">{e.actor_email}</td>
							{showVendor && (
								<td className="py-2 pr-4 text-xs">
									{e.vendor_id ? (
										<Link to={`/vendors/${e.vendor_id}/audit`} className="text-blue-600 hover:underline">
											{e.legal_name ?? e.vendor_id}
										</Link>
									) : (
										"—"
									)}
								</td>
							)}
							<td className="py-2 pr-4">
								<span className="font-medium">
									{e.entity_type}.{e.action}
								</span>
								<Diff before={e.before_json} after={e.after_json} />
							</td>
							<td className="py-2 pr-4 text-xs">{e.reason ?? "—"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
