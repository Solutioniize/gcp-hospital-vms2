import type { Route } from "./+types/vendor.audit";
import { requireUser } from "~/lib/auth.server";
import { listAudit } from "~/lib/db.server";
import { AuditTable } from "~/components/audit-table";
import { Card } from "~/components/ui";

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireUser(request, context);
	return { entries: await listAudit(context.cloudflare.env.DB, { vendorId: params.vendorId, limit: 1000 }) };
}

export default function VendorAudit({ loaderData }: Route.ComponentProps) {
	return (
		<Card title="Audit history">
			<p className="mb-4 text-xs text-gray-500">
				Append-only record of every change to this vendor, its documents and qualification decisions. Entries cannot
				be edited or deleted.
			</p>
			<AuditTable entries={loaderData.entries} />
		</Card>
	);
}
