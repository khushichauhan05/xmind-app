/**
 * Home — IG/FB hybrid feed.
 *
 * Lever: locus of control + curiosity gap.
 *  Tapping the logo jumps the feed to top (IG/Twitter muscle memory).
 *  The Stories rail surfaces "what's new" ahead of the chronological
 *  feed without forcing a click — peripheral discovery.
 *
 * Layout:
 *  - Top bar: wordmark on the left, notifications + inbox icons on the
 *    right (IG pattern). Inbox icon shows an unread badge sourced from
 *    `useConversations()`.
 *  - Stories rail at the top of the scrollable area.
 *  - Trending hashtag rail underneath stories (ephemeral discovery).
 *  - Feed of full-bleed PostCards.
 *
 * The composer is no longer inline on the home screen — the centred
 * Create button on the tab bar opens it as a modal stack screen, which
 * matches the IG/FB pattern and frees vertical space for actual feed
 * content.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { IconButton } from "@/components/ui/IconButton";
import PostsList from "@/components/PostsList";
import StoriesRail from "@/components/StoriesRail";
import TrendingRail from "@/components/TrendingRail";

import { useFeedRanking } from "@/hooks/useFeedRanking";
import { useTheme } from "@/hooks/useTheme";
import { useUserSync } from "@/hooks/useUserSync";
import { useConversations } from "@/hooks/useConversations";

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const {
    posts: rankedPosts,
    isLoading,
    error,
    refetch: refetchPosts,
  } = useFeedRanking({
    useAdvancedAlgorithm: true,
    maxPosts: 25,
    chronologicalBlendEvery: 4,
  });

  useUserSync();

  const { conversations } = useConversations();
  const inboxUnread = useMemo(
    () =>
      conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    [conversations]
  );

  const [scrollToTopKey, setScrollToTopKey] = useState(0);
  const onLogoPress = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setScrollToTopKey((k) => k + 1);
  }, []);

  const headerSlot = (
    <Surface
      variant="glass"
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <SafeAreaView edges={["top"]}>
        {/* Belt-and-suspenders layout: justifyContent: 'space-between' on
            the row PLUS a width:'100%' wrapper. This survives even if
            NativeWind doesn't compile or Metro serves a stale bundle —
            the wordmark sits left, the action group sits right, no flex
            arithmetic required. */}
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 10,
          }}
        >
          <Pressable
            onPress={onLogoPress}
            accessibilityRole="button"
            accessibilityLabel="Scroll feed to top"
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              tone="primary"
              weight="900"
              style={{
                fontSize: 28,
                lineHeight: 32,
                letterSpacing: -1.2,
              }}
            >
              xMind
            </Text>
          </Pressable>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <IconButton
              accessibilityLabel="Open notifications"
              variant="ghost"
              onPress={() => router.push("/notifications")}
            >
              <Feather name="heart" size={24} color={colors.text.primary} />
            </IconButton>
            <IconButton
              accessibilityLabel="Open inbox"
              variant="ghost"
              onPress={() => router.push("/messages")}
              badge={inboxUnread}
            >
              <Feather name="send" size={22} color={colors.text.primary} />
            </IconButton>
          </View>
        </View>
      </SafeAreaView>
    </Surface>
  );

  if (error && !rankedPosts?.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        {headerSlot}
        <EmptyState
          icon={<Feather name="alert-triangle" size={28} color={colors.tint.danger} />}
          title="The feed didn't load"
          description="A network hiccup, most likely. Pull down to try again."
          action={<Button label="Try again" onPress={() => refetchPosts()} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      {headerSlot}
      <PostsList
        posts={isLoading ? undefined : rankedPosts}
        scrollToTopKey={scrollToTopKey}
        ListHeaderComponent={
          <View>
            <StoriesRail />
            <View
              style={{
                height: 0.5,
                backgroundColor: colors.border.subtle,
                marginTop: 4,
              }}
            />
            <TrendingRail />
          </View>
        }
      />
    </View>
  );
}
