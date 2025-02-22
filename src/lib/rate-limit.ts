import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above
import { redis } from "./redis";

// Create a new ratelimiter, that allows 10 requests per day
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
});
