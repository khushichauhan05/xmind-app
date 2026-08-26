import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import PostsList from "@/components/PostsList";
import { useTheme } from "@/hooks/useTheme";
import { useSearch } from "@/hooks/useSearch";
import { formatNumber } from "@/utils/formatter";

/**
 * Hashtag-filtered feed.
 * Re-uses PostsList so the home feed and hashtag feed share rendering,
 * memoisation, and recycling — one cell type, two entry points.
 */
export default function HashtagPostsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { hashtag } = useLocalSearchParams<{ hashtag: string }>();
  const { getPostsByHashtag } = useSearch();

  const posts = getPostsByHashtag(hashtag || "");

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={["top"]} className="bg-canvas">
        <View className="flex-row items-center gap-md px-lg py-md border-b border-subtle">
          <IconButton accessibilityLabel="Back" onPress={() => router.back()} variant="filled">
            <Feather name="arrow-left" size={18} color={colors.text.primary} />
          </IconButton>
          <View className="flex-1">
            <Text variant="title" tone="tint" numberOfLines={1}>
              {hashtag}
            </Text>
            <Text variant="bodySm" tone="secondary">
              {formatNumber(posts.length)} {posts.length === 1 ? "post" : "posts"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {posts.length === 0 ? (
        <EmptyState
          icon={<Feather name="hash" size={28} color={colors.tint.primary} />}
          title="Nothing here yet"
          description={`Be the first to post with ${hashtag} — you might start the trend.`}
        />
      ) : (
        <PostsList posts={posts} />
      )}
    </View>
  );
}
