import { useQuery } from "@tanstack/react-query";

import { userApi, useApiClient } from "@/utils/api";
import type { User } from "@/types";

/**
 * Auth-bound profile of the current user. The `["authUser"]` cache key
 * is read by other hooks (e.g. optimistic like in `usePosts`) so we
 * unwrap the response inside `queryFn` rather than via `select`.
 *
 * Why: `select` only transforms what consumers see via `data`; the
 * underlying cache still holds the raw Axios response. Hooks that read
 * the cache directly via `queryClient.getQueryData(["authUser"])` need
 * the unwrapped `User` to be the actual stored value.
 */
export const useCurrentUser = () => {
  const api = useApiClient();

  const {
    data: currentUser,
    isLoading,
    error,
    refetch,
  } = useQuery<User | null>({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await userApi.getCurrentUser<User>(api);
      return response.data.user;
    },
    // Auth profile is small and stable; cache it longer than the default
    // to avoid refetching every time a screen mounts.
    staleTime: 5 * 60_000,
  });

  return { currentUser: currentUser ?? null, isLoading, error, refetch };
};
