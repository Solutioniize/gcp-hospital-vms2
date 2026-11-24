import { CRITICALITY, SERVICE_CATEGORIES } from "~/lib/constants";
import { Field, inputClass } from "./ui";

type Values = Partial<Record<string, string | null>>;
type Errors = Partial<Record<string, string>>;

export function VendorFields({ values = {}, errors = {} }: { values?: Values; errors?: Errors }) {
	const v = (k: string) => values[k] ?? "";
	return (
		<div className="space-y-6">
			<fieldset className="grid gap-4 sm:grid-cols-2">
				<legend className="mb-2 text-sm font-semibold text-gray-500">Organisation</legend>
				<Field label="Legal name *" error={errors.legal_name}>
					<input name="legal_name" defaultValue={v("legal_name")} required className={inputClass} />
				</Field>
				<Field label="Trading name">
					<input name="trading_name" defaultValue={v("trading_name")} className={inputClass} />
				</Field>
				<Field label="Service category *" error={errors.service_category}>
					<select name="service_category" defaultValue={v("service_category")} required className={inputClass}>
						<option value="">Choose…</option>
						{SERVICE_CATEGORIES.map((c) => (
							<option key={c}>{c}</option>
						))}
					</select>
				</Field>
				<Field label="Website">
					<input name="website" defaultValue={v("website")} className={inputClass} />
				</Field>
				<div className="sm:col-span-2">
					<Field label="Services provided for trials">
						<textarea name="services_description" defaultValue={v("services_description")} rows={3} className={inputClass} />
					</Field>
				</div>
			</fieldset>

			<fieldset>
				<legend className="mb-2 text-sm font-semibold text-gray-500">GCP criticality *</legend>
				<p className="mb-3 text-xs text-gray-500">
					Risk-based oversight (ICH E6(R3)): how much could this provider affect participant safety or the reliability
					of trial results? This sets the required documents and the requalification interval.
				</p>
				<div className="grid gap-3 sm:grid-cols-3">
					{Object.entries(CRITICALITY).map(([k, c]) => (
						<label
							key={k}
							className="flex cursor-pointer gap-3 rounded-md border border-gray-200 p-3 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-700 dark:has-[:checked]:bg-blue-950"
						>
							<input type="radio" name="criticality" value={k} defaultChecked={v("criticality") === k} required />
							<span>
								<span className="block text-sm font-medium">
									{c.label} <span className="font-normal text-gray-500">· requalify every {c.requalifyMonths / 12} yr</span>
								</span>
								<span className="block text-xs text-gray-500">{c.help}</span>
							</span>
						</label>
					))}
				</div>
				{errors.criticality && <p className="mt-1 text-xs text-red-600">{errors.criticality}</p>}
			</fieldset>

			<fieldset className="grid gap-4 sm:grid-cols-2">
				<legend className="mb-2 text-sm font-semibold text-gray-500">Contact</legend>
				<Field label="Contact name">
					<input name="contact_name" defaultValue={v("contact_name")} className={inputClass} />
				</Field>
				<Field label="Contact email" error={errors.contact_email}>
					<input name="contact_email" type="email" defaultValue={v("contact_email")} className={inputClass} />
				</Field>
				<Field label="Contact phone">
					<input name="contact_phone" defaultValue={v("contact_phone")} className={inputClass} />
				</Field>
				<Field label="Country">
					<input name="country" defaultValue={v("country")} className={inputClass} />
				</Field>
				<div className="sm:col-span-2">
					<Field label="Address">
						<textarea name="address" defaultValue={v("address")} rows={2} className={inputClass} />
					</Field>
				</div>
			</fieldset>
		</div>
	);
}
