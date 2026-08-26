/**
 * StoriesRail — Instagram-style horizontal avatars with gradient ring.
 *
 * Shell for future Stories backend. v1: no Story model server-side.
 * Pulls deduped post-author users from the cached feed and renders the
 * first 12 with gradient rings (all "unviewed" by default — future
 * server data will set `viewed` per user).
 *
 * Tapping a story opens a 5s full-screen viewer of the user's most
 * recent image post. The viewer is purely client-side; replacing it
 * with a real Story endpoint is a one-file swap.
 *
 * Lever: curiosity gap.
 *  Familiar Instagram pattern at the top of the feed nudges
 *  scroll-then-tap exploration without ever forcing a click.
 */
import React, { memo, useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { usePosts } from "@/hooks/usePosts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Post, User } from "@/types";

import { StoryViewer } from "./StoryViewer";

export interface StoriesRailProps {
  maxStories?: number;
}

interface StoryItem {
  user: User;
  /** Most recent image post for the user (used by the viewer). */
  post?: Post;
}

function StoriesRailImpl({ maxStories = 12 }: StoriesRailProps) {
  const { colors, spacing } = useTheme();
  const { posts } = usePosts();
  const { currentUser } = useCurrentUser();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stories = useMemo<StoryItem[]>(() => {
    const seen = new Map<string, StoryItem>();
    for (const p of posts) {
      if (!p.user?._id) continue;
      if (p.user._id === currentUser?._id) continue;
      const existing = seen.get(p.user._id);
      if (!existing) {
        seen.set(p.user._id, { user: p.user, post: p.image ? p : undefined });
      } else if (!existing.post && p.image) {
        existing.post = p;
      }
      if (seen.size >= maxStories) break;
    }
    return Array.from(seen.values()).slice(0, maxStories);
  }, [posts, currentUser?._id, maxStories]);

  const onPressStory = useCallback((idx: number) => setActiveIndex(idx), []);

  if (!currentUser && stories.length === 0) return null;

  return (
    <View style={{ paddingVertical: spacing.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          gap: spacing.md,
        }}
      >
        {/* Your story slot (placeholder — wires to create flow later). */}
        {currentUser ? (
          <View style={{ alignItems: "center", width: 72 }}>
            <View style={{ position: "relative" }}>
              <Avatar
                source={currentUser.profilePicture}
                name={`${currentUser.firstName} ${currentUser.lastName}`}
                size={64}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.tint.primary,
                  borderWidth: 3,
                  borderColor: colors.bg.canvas,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="caption" tone="inverse" weight="800" style={{ fontSize: 14 }}>
                  +
                </Text>
              </View>
            </View>
            <Text
              variant="caption"
              tone="primary"
              weight="600"
              numberOfLines={1}
              style={{ marginTop: spacing.xs }}
            >
              Your story
            </Text>
          </View>
        ) : null}

        {stories.map((s, idx) => (
          <Pressable
            key={s.user._id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${s.user.firstName}'s story`}
            onPress={() => onPressStory(idx)}
            style={({ pressed }) => ({
              alignItems: "center",
              width: 72,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Avatar
              source={s.user.profilePicture}
              name={`${s.user.firstName} ${s.user.lastName}`}
              size={64}
              story
            />
            <Text
              variant="caption"
              tone="primary"
              weight="600"
              numberOfLines={1}
              style={{ marginTop: spacing.xs, maxWidth: 64 }}
            >
              {s.user.firstName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <StoryViewer
        stories={stories}
        startIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
      />
    </View>
  );
}

export const StoriesRail = memo(StoriesRailImpl);
StoriesRail.displayName = "StoriesRail";

export default StoriesRail;
