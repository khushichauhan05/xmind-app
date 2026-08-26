/**
 * Explore — IG-style media-first discovery grid.
 *
 * Renamed from "Reels" because the data layer ships posts with photos,
 * not short-form video. Calling it Reels invited the wrong expectation;
 * Explore matches what the screen actually does — surface visual posts
 * across the network ranked by engagement velocity. When a video schema
 * lands, this screen can either branch into Reels or remain Explore and
 * a separate Reels tab can ship.
 *
 * Tapping a tile routes to the post detail screen so the experience is
 * consistent with notification taps and hashtag drills.
 */
import React, { useCallback, useMemo } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useFeedRanking } from "@/hooks/useFeedRanking";
import { useTheme } from "@/hooks/useTheme";
import type { Post } from "@/types";

const COLS = 3;

interface GridRow {
  id: string;
  posts: (Post | null)[];
}

export default function ReelsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const {
    posts,
    isLoading,
    refetch,
    isRefetching,
  } = useFeedRanking({
    useAdvancedAlgorithm: false,
    maxPosts: 80,
  });

  const mediaPosts = useMemo(
    () => (posts ?? []).filter((p) => !!p.image),
    [posts]
  );

  const rows = useMemo<GridRow[]>(() => {
    const out: GridRow[] = [];
    for (let i = 0; i < mediaPosts.length; i += COLS) {
      const slice = mediaPosts.slice(i, i + COLS);
      while (slice.length < COLS) slice.push(null as unknown as Post);
      out.push({
        id: slice[0]?._id ?? `row-${i}`,
        posts: slice,
      });
    }
    return out;
  }, [mediaPosts]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<GridRow>) => (
      <View style={{ flexDirection: "row" }}>
        {item.posts.map((p, idx) => (
          <Pressable
            key={p?._id ?? `empty-${idx}`}
            onPress={() =>
              p && router.push({ pathname: "/post/[postId]", params: { postId: p._id } })
            }
            disabled={!p?.image}
            style={{ flex: 1, aspectRatio: 1, padding: 1 }}
          >
            {p?.image ? (
              <ExpoImage
                source={{ uri: p.image }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.surface.sunken }} />
            )}
          </Pressable>
        ))}
      </View>
    ),
    [colors.surface.sunken, router]
  );

  const keyExtractor = useCallback((row: GridRow) => row.id, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border.subtle,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Feather name="compass" size={22} color={colors.tint.primary} />
          <Text variant="headline" tone="primary">
            Explore
          </Text>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            padding: 1,
            opacity: 0.7,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={{ width: "33.3%", aspectRatio: 1, padding: 1 }}>
              <Skeleton width="100%" height={300} radius={0} />
            </View>
          ))}
        </View>
      ) : mediaPosts.length === 0 ? (
        <EmptyState
          icon={<Feather name="compass" size={28} color={colors.tint.primary} />}
          title="Nothing to explore yet"
          description="Once people start posting photos, you'll see them here in a fast-scrolling grid."
        />
      ) : (
        <FlashList<GridRow>
          data={rows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.tint.primary}
              colors={[colors.tint.primary]}
            />
          }
        />
      )}
    </View>
  );
}
