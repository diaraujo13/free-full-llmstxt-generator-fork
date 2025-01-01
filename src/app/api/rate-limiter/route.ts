import { ratelimit } from "@/lib/rate-limit";
import { ipAddress, waitUntil } from "@vercel/functions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identifier = ipAddress(request) ?? request.headers.get("x-forwarded-for") ?? "127.0.0.1";

  const { success, pending } = await ratelimit.limit(identifier);

  waitUntil(pending);

  if (!success) {
    return new Response("Rate limit exceeded", { status: 429 });
  }
  return new Response("OK");
}
