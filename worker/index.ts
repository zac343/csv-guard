/** Cloudflare Worker entry point for CSV Guard. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function withSecurityHeaders(response: Response) {
  const secured = new Response(response.body, response);
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  secured.headers.set(
    "permissions-policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  secured.headers.set("x-frame-options", "DENY");
  return secured;
}

function normalizeInternalPath(pathname: string) {
  let decoded = pathname;

  // Vinext decodes and normalizes internal paths before routing. Mirror that
  // behavior here so encoded or repeated-slash aliases cannot reach a disabled
  // internal endpoint. The bounded loop also covers common double encoding.
  for (let pass = 0; pass < 4; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  const segments: string[] = [];
  for (const segment of decoded.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return `/${segments.join("/")}`.replace(/\.rsc$/, "");
}

function isImageOptimizerPath(pathname: string) {
  const normalized = normalizeInternalPath(pathname);
  return normalized === "/_vinext/image" || normalized.startsWith("/_vinext/image/");
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (isImageOptimizerPath(url.pathname)) {
      return withSecurityHeaders(new Response("Not found.", {
        status: 404,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
        },
      }));
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
};

export default worker;
