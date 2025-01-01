import { ratelimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identifier =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(',')[0] ??
      "127.0.0.1";

    const { remaining } = await ratelimit.getRemaining(identifier);

    return Response.json({ remaining });
  } catch (error) {
    console.error("Rate limit error:", error);
    return Response.json({ error: "Failed to check rate limit" }, { status: 500 });
  }
}
