import type { AppLoadContext } from "react-router";

export type User = { email: string; source: "access" | "dev" };

const DEV_USER = "dev.user@localhost";

type Jwk = JsonWebKey & { kid: string };
let certCache: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function getCerts(teamDomain: string, forceRefresh = false): Promise<Jwk[]> {
	const fresh = certCache && certCache.domain === teamDomain && Date.now() - certCache.fetchedAt < 60 * 60 * 1000;
	if (fresh && !forceRefresh) return certCache!.keys;
	const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
	if (!res.ok) throw new Error(`Could not fetch Cloudflare Access certs (${res.status})`);
	const body = (await res.json()) as { keys: Jwk[] };
	certCache = { domain: teamDomain, keys: body.keys, fetchedAt: Date.now() };
	return body.keys;
}

/** Verifies a Cloudflare Access JWT (RS256) and returns the user's email, or null. */
async function verifyAccessJwt(token: string, teamDomain: string, aud: string): Promise<string | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [h, p, sig] = parts;
	const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
	if (header.alg !== "RS256") return null;

	let keys = await getCerts(teamDomain);
	let jwk = keys.find((k) => k.kid === header.kid);
	if (!jwk) {
		keys = await getCerts(teamDomain, true);
		jwk = keys.find((k) => k.kid === header.kid);
	}
	if (!jwk) return null;

	const key = await crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
	const ok = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		b64urlToBytes(sig),
		new TextEncoder().encode(`${h}.${p}`),
	);
	if (!ok) return null;

	const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
	const now = Math.floor(Date.now() / 1000);
	const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud;
	if (!audOk) return null;
	if (payload.iss !== `https://${teamDomain}`) return null;
	if (typeof payload.exp !== "number" || payload.exp < now) return null;
	if (typeof payload.nbf === "number" && payload.nbf > now + 60) return null;
	return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
}

/**
 * Identifies the signed-in user. In production the app must sit behind Cloudflare Access,
 * and every request's Access JWT is verified. In local development (vite dev) it falls back
 * to a dev user so the app can be tried without Access.
 */
export async function requireUser(request: Request, context: AppLoadContext): Promise<User> {
	const env = context.cloudflare.env;
	const teamDomain = String(env.ACCESS_TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
	const aud = String(env.ACCESS_AUD || "");

	if (teamDomain && aud) {
		const token =
			request.headers.get("Cf-Access-Jwt-Assertion") ??
			request.headers
				.get("Cookie")
				?.split(/;\s*/)
				.find((c) => c.startsWith("CF_Authorization="))
				?.slice("CF_Authorization=".length);
		const email = token ? await verifyAccessJwt(token, teamDomain, aud).catch(() => null) : null;
		if (!email) throw new Response("Not authenticated", { status: 401 });
		return { email, source: "access" };
	}

	if (import.meta.env.DEV) {
		// Local development only: a `vms_dev_user` cookie lets you act as a second person,
		// e.g. to test that a different user must approve a qualification decision.
		const devCookie = request.headers
			.get("Cookie")
			?.split(/;\s*/)
			.find((c) => c.startsWith("vms_dev_user="))
			?.slice("vms_dev_user=".length);
		const email = devCookie ? decodeURIComponent(devCookie).toLowerCase() : DEV_USER;
		return { email, source: "dev" };
	}

	throw new Response(
		"Sign-in is not configured. Set ACCESS_TEAM_DOMAIN and ACCESS_AUD for Cloudflare Access.",
		{ status: 500 },
	);
}
