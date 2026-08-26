/**
 * Followers / Following list screen.
 *
 * Single screen drives both routes via the `?mode=followers|following`
 * query param so we don't ship two near-identical files. Each row
 * routes to the user-profile screen on tap.
 */
import React, { useCallback } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { useTheme } from "@/hooks/useTheme";
import { useApiClient, userApi } from "@/utils/api";
import type { User } from "@/types";

type Mode = "followers" | "following";

export default function FollowersScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { username, mode } = useLocalSearchParams<{
    username: string;
    mode?: Mode;
  }>();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const { showError } = useCustomAlert();
  const resolvedMode: Mode = mode === "following" ? "following" : "followers";

  // The Remove / Unfollow buttons only make sense on the *current* user's
  // own list. Viewing someone else's followers shouldn't expose these
  // actions — that's a different feature (Follow back / Block).
  const isOwnList =
    !!currentUser?.username && currentUser.username === username;

  const {
    data: users,
    isLoading,
    error,
  } = useQuery<User[]>({
    queryKey: ["user-list", username, resolvedMode],
    queryFn: async () => {
      if (!username) return [];
      const response =
        resolvedMode === "followers"
          ? await userApi.getFollowers<User>(api, username)
          : await userApi.getFollowing<User>(api, username);
      return response.data.users ?? [];
    },
    enabled: !!username,
    staleTime: 30_000,
  });

  // Shared optimistic-removal helper: pulls the targeted user out of the
  // cached list immediately so the row disappears with no perceptible
  // network latency. Both mutations roll back via the snapshot on error.
  const optimisticRemove = useCallback(
    (targetUserId: string) => {
      const key = ["user-list", username, resolvedMode] as const;
      queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<User[]>(key);
      queryClient.setQueryData<User[]>(key, (old) =>
        (old ?? []).filter((u) => u._id !== targetUserId)
      );
      return { previous };
    },
    [queryClient, resolvedMode, username]
  );

  const removeFollowerMutation = useMutation({
    mutationFn: (targetUserId: string) => userApi.removeFollower(api, targetUserId),
    onMutate: optimisticRemove,
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["user-list", username, resolvedMode],
          ctx.previous
        );
      }
      showError(
        "Couldn't remove",
        "We couldn't remove that follower. Try again in a moment."
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (targetUserId: string) => userApi.followUser(api, targetUserId),
    onMutate: optimisticRemove,
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["user-list", username, resolvedMode],
          ctx.previous
        );
      }
      showError(
        "Couldn't unfollow",
        "We couldn't unfollow that user. Try again in a moment."
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
    },
  });

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<User>) => {
      const onActionPress = () => {
        if (resolvedMode === "followers") {
          removeFollowerMutation.mutate(item._id);
        } else {
          unfollowMutation.mutate(item._id);
        }
      };
      const actionLabel = resolvedMode === "followers" ? "Remove" : "Unfollow";

      return (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/user-profile",
              params: { userId: item._id, username: item.username },
            })
          }
          android_ripple={{ color: colors.overlay.press }}
          accessibilityRole="button"
          accessibilityLabel={`Open profile of ${item.firstName} ${item.lastName}`}
        >
          <Card
            variant="solid"
            className="mx-base mb-sm p-base border border-subtle"
          >
            <View className="flex-row items-center gap-md">
              <Avatar
                source={item.profilePicture}
                name={`${item.firstName} ${item.lastName}`}
                size={44}
              />
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center">
                  <Text
                    variant="subtitle"
                    tone="primary"
                    weight="700"
                    numberOfLines={1}
                    className="shrink mr-xs"
                  >
                    {item.firstName} {item.lastName}
                  </Text>
                  {item.verified ? <VerifiedBadge size={14} /> : null}
                </View>
                <Text variant="bodySm" tone="secondary" numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
              {isOwnList ? (
                <Button
                  label={actionLabel}
                  size="sm"
                  variant="secondary"
                  onPress={onActionPress}
                />
              ) : (
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.text.tertiary}
                />
              )}
            </View>
          </Card>
        </Pressable>
      );
    },
    [
      colors.overlay.press,
      colors.text.tertiary,
      isOwnList,
      removeFollowerMutation,
      resolvedMode,
      router,
      unfollowMutation,
    ]
  );

  const keyExtractor = useCallback((u: User) => u._id, []);

  const title = resolvedMode === "followers" ? "Followers" : "Following";

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={["top"]}>
        <View className="w-full flex-row items-center px-lg py-md gap-md border-b-[0.5px] border-subtle">
          <IconButton accessibilityLabel="Back" onPress={() => router.back()} variant="filled">
            <Feather name="arrow-left" size={18} color={colors.text.primary} />
          </IconButton>
          <View className="flex-1">
            <Text variant="title" tone="primary">
              {title}
            </Text>
            <Text variant="bodySm" tone="secondary">
              @{username}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View className="px-lg pt-md gap-md">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-row items-center gap-base">
              <Skeleton width={48} height={48} radius={24} />
              <View className="flex-1 gap-[6px]">
                <Skeleton width="40%" height={14} />
                <Skeleton width="60%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon={<Feather name="alert-triangle" size={28} color={colors.tint.danger} />}
          title="Couldn't load this list"
          description="Network blip, most likely. Pull back and try again."
        />
      ) : !users || users.length === 0 ? (
        <EmptyState
          icon={<Feather name="users" size={28} color={colors.tint.primary} />}
          title={
            resolvedMode === "followers"
              ? "No followers yet"
              : "Not following anyone yet"
          }
          description={
            resolvedMode === "followers"
              ? "Once people follow this account, they'll show up here."
              : "Search for people you know and tap Follow to start filling this list."
          }
        />
      ) : (
        <FlashList<User>
          data={users}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: spacing.md,
            paddingBottom: 80,
          }}
        />
      )}
    </View>
  );
}
