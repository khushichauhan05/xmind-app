import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, userApi } from "../utils/api";
import { User } from "../types";

export const useUserProfile = (username?: string) => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const {
    data: userData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["userProfile", username],
    queryFn: () => userApi.getUserProfile(api, username!),
    select: (response) => response.data.user,
    enabled: !!username,
  });

  const followUserMutation = useMutation({
    mutationFn: (targetUserId: string) => userApi.followUser(api, targetUserId),
    onSuccess: () => {
      // Invalidate user profile queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
      // Also invalidate current user queries to update following/followers counts
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      // Invalidate posts queries if needed
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts", username] });
    },
    onError: (error: any) => {
      console.error("Follow/Unfollow error:", error);
    },
  });

  const toggleFollow = (targetUserId: string) => {
    followUserMutation.mutate(targetUserId);
  };

  return {
    user: userData as User | undefined,
    isLoading,
    error,
    refetch,
    toggleFollow,
    isFollowLoading: followUserMutation.isPending,
  };
};
