import type { ReactNode } from "react";
import { VENDOR_STATUS, type VendorStatus } from "~/lib/constants";

export function StatusBadge({ status }: { status: VendorStatus }) {
	const s = VENDOR_STATUS[status];
	return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>;
}

const PILL_TONES = {
	gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	green: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
	amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
	red: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
	blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
};

export function Pill({ tone = "gray", children }: { tone?: keyof typeof PILL_TONES; children: ReactNode }) {
	return (
		<span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}>
			{children}
		</span>
	);
}

export function riskTone(level: string): keyof typeof PILL_TONES {
	return level === "high" ? "red" : level === "medium" ? "amber" : "green";
}

export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
	return (
		<section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			{(title || actions) && (
				<div className="mb-4 flex items-center justify-between gap-4">
					{title && <h2 className="text-base font-semibold">{title}</h2>}
					{actions}
				</div>
			)}
			{children}
		</section>
	);
}

export const inputClass =
	"block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950";

export const buttonClass =
	"inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

export const secondaryButtonClass =
	"inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800";

export function Field({
	label,
	hint,
	error,
	children,
}: {
	label: string;
	hint?: string;
	error?: string;
	children: ReactNode;
}) {
	return (
		<label className="block space-y-1">
			<span className="text-sm font-medium">{label}</span>
			{children}
			{hint && !error && <span className="block text-xs text-gray-500">{hint}</span>}
			{error && <span className="block text-xs text-red-600">{error}</span>}
		</label>
	);
}

export function ErrorBanner({ message }: { message?: string | null }) {
	if (!message) return null;
	return (
		<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
			{message}
		</div>
	);
}

export function formatDateTime(iso: string | null) {
	if (!iso) return "—";
	return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function formatBytes(n: number) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
