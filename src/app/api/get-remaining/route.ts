export const dynamic = "force-dynamic";

import { ratelimit } from "@/lib/rate-limit";
import { ipAddress } from "@vercel/functions";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const identifier =
      ipAddress(request) ??
      request.headers.get("x-forwarded-for") ??
      request.headers.get("cf-connecting-ip") ??
      "127.0.0.1";

    const { remaining } = await ratelimit.getRemaining(identifier);

    return Response.json({ remaining });
  } catch (error) {
    console.error("Rate limit error:", error);
    return Response.json({ error: "Failed to check rate limit" }, { status: 500 });
  }
}
