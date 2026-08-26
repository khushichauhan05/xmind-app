import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

import { userApi, useApiClient } from "@/utils/api";
import type { User } from "@/types";

/**
 * Best-effort one-time sync of the Clerk user → backend profile when
 * the user signs in. Runs at app boot from the Home screen so the
 * `["authUser"]` cache is warm by the time the feed renders.
 *
 * Why a separate hook: the sync endpoint is idempotent on the server,
 * but firing it from inside `useCurrentUser` would couple the read with
 * the write and risk infinite churn if the sync ever errored.
 */
export const useUserSync = () => {
  const { isSignedIn } = useAuth();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const syncUserMutation = useMutation({
    mutationFn: async () => {
      const response = await userApi.syncUser<User>(api);
      return response.data.user;
    },
    onSuccess: (user) => {
      // Seed the auth cache so the first read on Home is a cache hit.
      queryClient.setQueryData<User>(["authUser"], user);
    },
    onError: (error) => {
      if (__DEV__) console.error("[userSync] failed:", error);
    },
  });

  useEffect(() => {
    if (isSignedIn && !syncUserMutation.data && !syncUserMutation.isPending) {
      syncUserMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return null;
};
