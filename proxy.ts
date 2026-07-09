import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveZone, isPathAllowedForZone } from "@/lib/proxy/zones";
import { resolveTenantFromHost } from "@/lib/tenant/registry";
import { requireZone } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "localhost";
  const { zone, rewrittenPathname } = resolveZone(hostname, request.nextUrl.pathname);

  if (!isPathAllowedForZone(zone, rewrittenPathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (zone !== "storefront" && !requireZone(zone).allowed) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const tenant = resolveTenantFromHost(hostname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);

  const url = request.nextUrl.clone();
  url.pathname = rewrittenPathname;

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
