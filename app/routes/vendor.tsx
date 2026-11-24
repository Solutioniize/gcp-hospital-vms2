import { NavLink, Outlet } from "react-router";
import type { Route } from "./+types/vendor";
import { requireUser } from "~/lib/auth.server";
import { getVendor } from "~/lib/db.server";
import { CRITICALITY } from "~/lib/constants";
import { StatusBadge } from "~/components/ui";

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.vendor.legal_name ?? "Vendor"} · Hospital VMS` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireUser(request, context);
	const vendor = await getVendor(context.cloudflare.env.DB, params.vendorId);
	if (!vendor) throw new Response("Vendor not found", { status: 404 });
	return { vendor };
}

const tab = ({ isActive }: { isActive: boolean }) =>
	`border-b-2 px-3 py-2 text-sm font-medium ${
		isActive
			? "border-blue-600 text-blue-600"
			: "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
	}`;

export default function VendorLayout({ loaderData }: Route.ComponentProps) {
	const { vendor } = loaderData;
	return (
		<div className="space-y-4">
			<div>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-2xl font-semibold">{vendor.legal_name}</h1>
					<StatusBadge status={vendor.status} />
				</div>
				<p className="mt-1 text-sm text-gray-500">
					{vendor.service_category} · {CRITICALITY[vendor.criticality].label} criticality
					{vendor.next_requalification_date && <> · Requalify by {vendor.next_requalification_date}</>}
				</p>
			</div>
			<nav className="flex gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
				<NavLink to="." end className={tab}>
					Overview
				</NavLink>
				<NavLink to="documents" className={tab}>
					Documents
				</NavLink>
				<NavLink to="qualification" className={tab}>
					Qualification
				</NavLink>
				<NavLink to="audit" className={tab}>
					Audit history
				</NavLink>
			</nav>
			<Outlet />
		</div>
	);
}
