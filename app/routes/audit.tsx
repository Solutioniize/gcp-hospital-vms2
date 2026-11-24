import type { Route } from "./+types/audit";
import { requireUser } from "~/lib/auth.server";
import { AuditTable } from "~/components/audit-table";
import { Card } from "~/components/ui";

export function meta() {
	return [{ title: "Audit trail · Hospital VMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	await requireUser(request, context);
	const { results } = await context.cloudflare.env.DB.prepare(
		`SELECT a.*, v.legal_name FROM audit_log a LEFT JOIN vendors v ON v.id = a.vendor_id ORDER BY a.id DESC LIMIT 500`,
	).all<{
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
		legal_name: string | null;
	}>();
	return { entries: results };
}

export default function Audit({ loaderData }: Route.ComponentProps) {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Audit trail</h1>
			<Card>
				<p className="mb-4 text-xs text-gray-500">The 500 most recent entries across all vendors. The log is append-only.</p>
				<AuditTable entries={loaderData.entries} showVendor />
			</Card>
		</div>
	);
}
