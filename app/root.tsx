import {
	isRouteErrorResponse,
	Links,
	Meta,
	NavLink,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";
import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function meta() {
	return [{ title: "Vendor Management System" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const user = await requireUser(request, context);
	return { user };
}

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

const navClass = ({ isActive }: { isActive: boolean }) =>
	`rounded-md px-3 py-2 text-sm font-medium ${
		isActive
			? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
			: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
	}`;

export default function App({ loaderData }: Route.ComponentProps) {
	const { user } = loaderData;
	return (
		<>
			<header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
					<NavLink to="/" className="text-base font-semibold">
						Hospital VMS
					</NavLink>
					<nav className="flex flex-wrap gap-1">
						<NavLink to="/" end className={navClass}>
							Dashboard
						</NavLink>
						<NavLink to="/vendors" className={navClass}>
							Vendors
						</NavLink>
						<NavLink to="/audit" className={navClass}>
							Audit trail
						</NavLink>
					</nav>
					<div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
						{user.email}
						{user.source === "dev" && (
							<span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">dev sign-in</span>
						)}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6">
				<Outlet />
			</main>
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
