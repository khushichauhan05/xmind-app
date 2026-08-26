import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { notificationApi, useApiClient } from "@/utils/api";
import type { Notification } from "@/types";

/**
 * Notifications inbox. Cached for 30 s — short enough to feel live when
 * the user pulls to refresh, long enough that the inbox tab swap doesn't
 * blink while react-query revalidates.
 */
export const useNotifications = () => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await notificationApi.getNotifications<Notification>(api);
      return response.data.notifications;
    },
    staleTime: 30_000,
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      notificationApi.deleteNotification(api, notificationId).then((r) => r.data),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications"]);
      queryClient.setQueryData<Notification[]>(["notifications"], (old) =>
        old ? old.filter((n) => n._id !== notificationId) : old
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["notifications"], ctx.previous);
    },
  });

  return {
    notifications: notifications ?? [],
    isLoading,
    error,
    refetch,
    isRefetching,
    deleteNotification: deleteNotificationMutation.mutate,
    isDeletingNotification: deleteNotificationMutation.isPending,
  };
};
