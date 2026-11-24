import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/vendors.new";
import { requireUser } from "~/lib/auth.server";
import { createVendor } from "~/lib/db.server";
import { parseVendorForm } from "~/lib/forms.server";
import { VendorFields } from "~/components/vendor-form";
import { Card, buttonClass, secondaryButtonClass } from "~/components/ui";

export function meta() {
	return [{ title: "Onboard vendor · Hospital VMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	await requireUser(request, context);
	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const user = await requireUser(request, context);
	const { input, errors, ok } = parseVendorForm(await request.formData());
	if (!ok) return { errors, values: input };
	const id = await createVendor(context.cloudflare.env.DB, input, user.email);
	return redirect(`/vendors/${id}/documents`);
}

export default function NewVendor({ actionData }: Route.ComponentProps) {
	const busy = useNavigation().state === "submitting";
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Onboard a new vendor</h1>
			<p className="text-sm text-gray-600 dark:text-gray-400">
				Step 1 of 3: vendor details. Next you'll upload qualification documents, then complete the risk assessment.
			</p>
			<Card>
				<Form method="post" className="space-y-6">
					<VendorFields values={actionData?.values} errors={actionData?.errors} />
					<div className="flex gap-3">
						<button className={buttonClass} disabled={busy}>
							{busy ? "Saving…" : "Create vendor and continue"}
						</button>
						<Link to="/vendors" className={secondaryButtonClass}>
							Cancel
						</Link>
					</div>
				</Form>
			</Card>
		</div>
	);
}
