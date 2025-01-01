import { useEffect } from "react";

import { useState } from "react";

interface RateLimitData {
  remaining: number;
}

export function useRateLimit() {
  const [data, setData] = useState<RateLimitData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkRateLimit = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/get-remaining", {
          next: {
            tags: ["get-remaining"]
          }
        });

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch rate limit'));
      } finally {
        setIsLoading(false);
      }
    };

    checkRateLimit();
  }, []);

  return { data, isLoading, error };
};