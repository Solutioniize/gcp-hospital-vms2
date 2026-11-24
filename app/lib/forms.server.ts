import { CRITICALITY, SERVICE_CATEGORIES } from "./constants";
import { EDITABLE_VENDOR_FIELDS, type VendorInput } from "./db.server";

export function str(form: FormData, key: string): string | null {
	const v = form.get(key);
	if (typeof v !== "string") return null;
	const t = v.trim();
	return t === "" ? null : t;
}

export function parseVendorForm(form: FormData) {
	const input = Object.fromEntries(EDITABLE_VENDOR_FIELDS.map((f) => [f, str(form, f)])) as VendorInput;
	const errors: Partial<Record<keyof VendorInput, string>> = {};
	if (!input.legal_name) errors.legal_name = "Legal name is required.";
	if (!input.service_category || !(SERVICE_CATEGORIES as readonly string[]).includes(input.service_category))
		errors.service_category = "Choose a service category.";
	if (!input.criticality || !(input.criticality in CRITICALITY)) errors.criticality = "Choose a criticality.";
	if (input.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.contact_email))
		errors.contact_email = "Enter a valid email address.";
	if (input.website && !/^https?:\/\//.test(input.website)) input.website = `https://${input.website}`;
	return { input, errors, ok: Object.keys(errors).length === 0 };
}
