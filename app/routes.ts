import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/dashboard.tsx"),
	route("vendors", "routes/vendors.tsx"),
	route("vendors/new", "routes/vendors.new.tsx"),
	route("vendors/:vendorId", "routes/vendor.tsx", [
		index("routes/vendor.overview.tsx"),
		route("documents", "routes/vendor.documents.tsx"),
		route("qualification", "routes/vendor.qualification.tsx"),
		route("audit", "routes/vendor.audit.tsx"),
	]),
	route("vendors/:vendorId/documents/:docId/file", "routes/vendor.document-file.ts"),
	route("audit", "routes/audit.tsx"),
] satisfies RouteConfig;
