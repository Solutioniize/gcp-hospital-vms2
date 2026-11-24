import type { Route } from "./+types/vendor.document-file";
import { requireUser } from "~/lib/auth.server";
import { getDocument } from "~/lib/db.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireUser(request, context);
	const { DB, DOCS } = context.cloudflare.env;
	const doc = await getDocument(DB, params.vendorId, params.docId);
	if (!doc) throw new Response("Document not found", { status: 404 });
	const obj = await DOCS.get(doc.r2_key);
	if (!obj) throw new Response("File missing from storage", { status: 404 });
	return new Response(obj.body, {
		headers: {
			"Content-Type": doc.content_type,
			"Content-Disposition": `inline; filename="${doc.file_name.replace(/"/g, "")}"`,
			"X-Content-SHA256": doc.sha256,
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "sandbox",
			"Cache-Control": "private, no-store",
		},
	});
}
