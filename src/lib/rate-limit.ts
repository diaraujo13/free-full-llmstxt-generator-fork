import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above
import { redis } from "./redis";

// Create a new ratelimiter, that allows 5 requests per day
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "24 h"),
  analytics: true,
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * "@upstash/ratelimit"
   */
  prefix: "@upstash/ratelimit",
});
