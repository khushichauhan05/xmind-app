/**
 * Saved posts screen.
 *
 * Reads bookmark ids from `useBookmarksStore` (AsyncStorage-backed) and
 * pulls each post via `postApi.getPost`. Posts the user has bookmarked
 * but that no longer exist (deleted by author) are silently dropped.
 *
 * Why client-driven: bookmarks are device-local in V1. When we move
 * them server-side, this screen swaps the source query without changing
 * the visual contract.
 */
import React, { useCallback, useEffect, useMemo } from "react";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueries } from "@tanstack/react-query";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import PostCard from "@/components/PostCard";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePosts } from "@/hooks/usePosts";
import { useBookmarksStore } from "@/stores/useBookmarksStore";
import { postApi, useApiClient } from "@/utils/api";
import type { Post } from "@/types";

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const api = useApiClient();
  const { currentUser } = useCurrentUser();
  const {
    toggleLike,
    toggleReshare,
    deletePost,
    checkIsLiked,
    checkIsReshared,
  } = usePosts();

  // Select the Set directly — Zustand uses Object.is to detect changes,
  // and `Array.from(set)` returns a fresh array every call, which makes
  // every render look like a state change and triggers an infinite loop.
  const postIdsSet = useBookmarksStore((s) => s.postIds);
  const isHydrated = useBookmarksStore((s) => s.isHydrated);
  const hydrate = useBookmarksStore((s) => s.hydrate);
  const removeBookmark = useBookmarksStore((s) => s.toggle);

  const postIds = useMemo(() => Array.from(postIdsSet), [postIdsSet]);

  useEffect(() => {
    if (!isHydrated) hydrate().catch(() => undefined);
  }, [hydrate, isHydrated]);

  const queries = useQueries({
    queries: postIds.map((id) => ({
      queryKey: ["post", id],
      queryFn: async (): Promise<Post | null> => {
        try {
          const response = await postApi.getPost<Post>(api, id, {
            silent404: true,
          });
          return response.data.post;
        } catch (e) {
          // A bookmarked post that's since been deleted is "drop from
          // list", not a screen error. silent404 suppresses the
          // [api] error log line for that 404 specifically.
          const status = (e as AxiosError | undefined)?.response?.status;
          if (status === 404) return null;
          throw e;
        }
      },
      staleTime: 60_000,
      retry: false,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const posts = useMemo(
    () =>
      queries
        .map((q) => q.data)
        .filter((p): p is Post => !!p),
    [queries]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => {
      const source = item.originalPost ?? item;
      return (
        <PostCard
          post={item}
          currentUser={currentUser}
          isLiked={checkIsLiked(source.likes, currentUser)}
          isReshared={checkIsReshared(item, currentUser)}
          onLike={(id) => toggleLike(id)}
          onReshare={(id) => toggleReshare(id)}
          onComment={() =>
            router.push({ pathname: "/post/[postId]", params: { postId: source._id } })
          }
          onDelete={(id) => deletePost(id)}
          onMore={() => removeBookmark(source._id)}
        />
      );
    },
    [
      checkIsLiked,
      checkIsReshared,
      currentUser,
      deletePost,
      removeBookmark,
      router,
      toggleLike,
      toggleReshare,
    ]
  );

  const keyExtractor = useCallback((p: Post) => p._id, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <IconButton accessibilityLabel="Back" onPress={() => router.back()} variant="filled">
            <Feather name="arrow-left" size={18} color={colors.text.primary} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Text variant="title" tone="primary">
              Saved
            </Text>
            <Text variant="bodySm" tone="secondary">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {isLoading && posts.length === 0 ? (
        <View
          style={{
            paddingHorizontal: spacing.base,
            paddingTop: spacing.md,
            gap: spacing.md,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={180} radius={20} />
          ))}
        </View>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Feather name="bookmark" size={28} color={colors.tint.primary} />}
          title="Nothing saved yet"
          description="Tap the bookmark icon on any post to save it. Saved posts live here for whenever you're ready to read them again."
          action={
            <Button
              label="Explore the feed"
              variant="secondary"
              onPress={() => router.replace("/(tabs)")}
            />
          }
        />
      ) : (
        <FlashList<Post>
          data={posts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 80 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
