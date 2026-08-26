import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import UserSearchResult from "@/components/UserSearchResult";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSearch, useUserSearchServer } from "@/hooks/useSearch";
import { useTrendingHashtags } from "@/hooks/useTrendingHashtags";
import { formatNumber } from "@/utils/formatter";
import type { User } from "@/types";

const MAX_USER_RESULTS = 50;

/**
 * Search.
 *
 * Psychology lever — Locus of control + Hick's Law:
 *  Resting state offers two clearly-bounded shortcuts (trending tags +
 *  suggested users). Empty input ≠ empty screen. The user always has
 *  somewhere to go without a single keystroke. Active state filters
 *  the cached feed via `useDeferredValue` so each keystroke updates
 *  the input immediately while the heavy filter runs at lower priority.
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { currentUser } = useCurrentUser();
  const { suggestedUsers, searchUsers, searchPosts } = useSearch();
  const { trending } = useTrendingHashtags(10);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const localUserResults = searchUsers(deferredQuery);
  const serverUserResults = useUserSearchServer(deferredQuery);

  // Merge local Fuse hits with server hits — dedupe by _id, exclude
  // the current user, cap to a sane number. Local first because they're
  // already in cache and feel instant; server matches fill the long tail
  // (followers who haven't posted, etc).
  const userResults = useMemo<User[]>(() => {
    const seen = new Set<string>();
    const merged: User[] = [];
    for (const u of localUserResults) {
      if (u._id === currentUser?._id) continue;
      if (seen.has(u._id)) continue;
      seen.add(u._id);
      merged.push(u);
    }
    for (const u of serverUserResults) {
      if (u._id === currentUser?._id) continue;
      if (seen.has(u._id)) continue;
      seen.add(u._id);
      merged.push(u);
    }
    return merged.slice(0, MAX_USER_RESULTS);
  }, [localUserResults, serverUserResults, currentUser?._id]);

  const postResults = searchPosts(deferredQuery);
  const showResults = deferredQuery.trim().length > 0;
  const totalResults = userResults.length + postResults.length;

  const onClear = useCallback(() => setQuery(""), []);

  const onHashtag = useCallback(
    (hashtag: string) =>
      router.push({ pathname: "/hashtag-posts", params: { hashtag } }),
    [router]
  );

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={["top"]}>
        <View className="px-lg py-md gap-md">
          <Text variant="headline" tone="primary">
            Discover
          </Text>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, handle, or hashtag"
            autoFocus={false}
            returnKeyType="search"
            leading={<Feather name="search" size={18} color={colors.text.tertiary} />}
            trailing={
              query.length > 0 ? (
                <Pressable
                  onPress={onClear}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  className="w-[28px] h-[28px] rounded-pill items-center justify-center bg-surface-sunken"
                >
                  <Feather name="x" size={14} color={colors.text.secondary} />
                </Pressable>
              ) : null
            }
          />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingBottom: 140 + insets.bottom,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showResults ? (
          totalResults > 0 ? (
            <>
              {userResults.length > 0 ? (
                <Card variant="solid" padding={0}>
                  <View
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingTop: spacing.lg,
                      paddingBottom: spacing.sm,
                    }}
                  >
                    <Text variant="label" tone="tertiary" weight="700">
                      People · {userResults.length}
                    </Text>
                  </View>
                  {userResults.map((u) => (
                    <UserSearchResult key={u._id} user={u} />
                  ))}
                </Card>
              ) : null}

              {postResults.length > 0 ? (
                <Card variant="solid">
                  <Text
                    variant="label"
                    tone="tertiary"
                    weight="700"
                    style={{ marginBottom: spacing.sm }}
                  >
                    Posts · {postResults.length}
                  </Text>
                  {postResults.slice(0, 6).map((post) => (
                    <Pressable
                      key={post._id}
                      onPress={() =>
                        router.push({
                          pathname: "/user-profile",
                          params: { userId: post.user._id, username: post.user.username },
                        })
                      }
                      android_ripple={{ color: colors.overlay.press }}
                      style={({ pressed }) => ({
                        paddingVertical: spacing.sm,
                        opacity: pressed ? 0.85 : 1,
                        borderTopWidth: 1,
                        borderTopColor: colors.border.subtle,
                      })}
                    >
                      <Text variant="bodySm" tone="tertiary">
                        @{post.user.username}
                      </Text>
                      <Text variant="body" tone="primary" numberOfLines={2}>
                        {post.content}
                      </Text>
                    </Pressable>
                  ))}
                </Card>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<Feather name="search" size={26} color={colors.tint.primary} />}
              title="Nothing matches yet"
              description="Try a different spelling, a shorter name, or a hashtag."
            />
          )
        ) : (
          <>
            {/* Trending now — full panel */}
            <Card variant="solid">
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}
              >
                <Feather name="zap" size={16} color={colors.tint.primary} />
                <Text variant="title" tone="primary">
                  Trending now
                </Text>
              </View>

              {trending.length > 0 ? (
                trending.slice(0, 8).map((item, i) => (
                  <Pressable
                    key={`${item.hashtag}-${i}`}
                    onPress={() => onHashtag(item.hashtag)}
                    android_ripple={{ color: colors.overlay.press }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border.subtle,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="caption" tone="tertiary">
                      {i + 1} · Trending
                    </Text>
                    <Text variant="subtitle" tone="tint" weight="700">
                      {item.hashtag}
                    </Text>
                    <Text variant="bodySm" tone="secondary">
                      {formatNumber(item.count)} {item.count === 1 ? "post" : "posts"} in 24h
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Surface
                  variant="sunken"
                  radius={16}
                  className="p-lg items-center gap-sm"
                >
                  <Feather name="hash" size={22} color={colors.text.tertiary} />
                  <Text variant="body" tone="secondary" align="center">
                    No trends yet. Post with a hashtag and you might start one.
                  </Text>
                </Surface>
              )}
            </Card>

            {/* Suggested people */}
            {suggestedUsers.length > 0 ? (
              <Card variant="solid" padding={0}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    paddingHorizontal: spacing.lg,
                    paddingTop: spacing.lg,
                    paddingBottom: spacing.sm,
                  }}
                >
                  <Feather name="users" size={16} color={colors.tint.primary} />
                  <Text variant="title" tone="primary">
                    People to follow
                  </Text>
                </View>
                {suggestedUsers.map((u) => (
                  <UserSearchResult key={u._id} user={u} />
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}