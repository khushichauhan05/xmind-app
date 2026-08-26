/**
 * TrendingRail — horizontal scroller of "what's hot in the last 24h".
 *
 * Architectural role:
 *  Above-the-feed surface that turns the empty space between composer
 *  and first post into a discovery affordance. Pulls from the
 *  /trending endpoint and tap-routes into the existing hashtag-posts
 *  screen so we re-use the feed list for the click-through.
 *
 * Psychology lever:
 *  Curiosity gap. A trending tag with a follower count attached is a
 *  miniature open loop — "31 people in the last hour, what's the
 *  conversation?" The rail's horizontal scroll matches the user's
 *  scanning instinct (left to right, lighter cognitive load than
 *  vertical), so the discovery happens in passing.
 */
import React, { memo, useCallback } from "react";
import { Pressable, View } from "react-native";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Surface } from "@/components/ui/Surface";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import {
  useTrendingHashtags,
  type TrendingHashtag,
} from "@/hooks/useTrendingHashtags";
import { formatNumber } from "@/utils/formatter";

function TrendingRailImpl() {
  const { colors, spacing, radii } = useTheme();
  const router = useRouter();
  const { trending, isLoading } = useTrendingHashtags(8);

  const onPress = useCallback(
    (hashtag: string) => {
      Haptics.selectionAsync().catch(() => undefined);
      router.push({ pathname: "/hashtag-posts", params: { hashtag } });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TrendingHashtag>) => (
      <Pressable
        onPress={() => onPress(item.hashtag)}
        accessibilityRole="button"
        accessibilityLabel={`Open posts for ${item.hashtag}`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          marginRight: spacing.sm,
        })}
      >
        <Surface
          variant="solid"
          radius={radii.pill}
          style={{
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            minHeight: 36,
          }}
        >
          <Feather name="trending-up" size={12} color={colors.tint.primary} />
          <Text variant="label" tone="primary" weight="600">
            {item.hashtag}
          </Text>
          <Text variant="caption" tone="tertiary">
            {formatNumber(item.count)}
          </Text>
        </Surface>
      </Pressable>
    ),
    [colors, onPress, radii.pill, spacing]
  );

  const keyExtractor = useCallback((item: TrendingHashtag) => item.hashtag, []);

  if (isLoading) {
    return (
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.base,
          marginVertical: spacing.sm,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={92} height={36} radius={999} />
        ))}
      </View>
    );
  }

  if (!trending.length) return null;

  return (
    <View style={{ marginVertical: spacing.sm }}>
      <View
        style={{
          paddingHorizontal: spacing.base,
          marginBottom: spacing.xs,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        <Feather name="zap" size={14} color={colors.tint.primary} />
        <Text variant="label" tone="secondary" weight="700">
          Trending now
        </Text>
      </View>
      <FlashList
        horizontal
        data={trending}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
        }}
      />
    </View>
  );
}

export const TrendingRail = memo(TrendingRailImpl);
TrendingRail.displayName = "TrendingRail";

export default TrendingRail;
