import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Returns a 429 NextResponse if rate limit exceeded, null if allowed or if Redis is unavailable (fail open)
export async function checkRateLimit(
  req: NextRequest,
  limitKey: string,
  maxRequests: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
    });

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: "rl",
    });

    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const identifier = `${limitKey}:${ip}`;

    const { success, reset } = await ratelimit.limit(identifier);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter > 0 ? retryAfter : 1) },
        }
      );
    }

    return null;
  } catch (err) {
    console.warn("[rate-limit] Redis unavailable, failing open:", err);
    return null;
  }
}
