/**
 * Hook — fetches the trending hashtags rail.
 *
 * Architectural role:
 *  Talks to the new `GET /api/posts/trending` endpoint, which aggregates
 *  the last 24 hours of posts and returns the top-N hashtags by velocity.
 *  Cached on the server with a 5-minute TTL, and locally with a
 *  React-Query staleTime of 60s so the home screen doesn't refetch on
 *  every focus. Falls back to `[]` on error so the rail simply hides
 *  rather than disrupting the home screen.
 */
import { useQuery } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";

import { useApiClient } from "@/utils/api";

export interface TrendingHashtag {
  hashtag: string;
  count: number;
  velocity: number;
}

interface TrendingResponse {
  hashtags: TrendingHashtag[];
  generatedAt: string;
}

export const useTrendingHashtags = (limit = 8) => {
  const api = useApiClient();

  const { data, isLoading, refetch } = useQuery<TrendingHashtag[]>({
    queryKey: ["trendingHashtags", limit],
    queryFn: async () => {
      try {
        const response: AxiosResponse<TrendingResponse> = await api.get(
          "/posts/trending",
          { params: { limit } }
        );
        return response.data?.hashtags ?? [];
      } catch {
        // Server may not have this endpoint deployed yet, or the
        // serverless cold start exceeded our 15s axios timeout. The
        // home screen treats `[]` as "hide the rail" so the failure
        // is silent for the user.
        return [];
      }
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  return {
    trending: data ?? [],
    isLoading,
    refetch,
  };
};
