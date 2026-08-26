/**
 * ShareToChatSheet — bottom-sheet picker for sending a post into a DM.
 *
 * Pulls the current user's friends + people you follow from the cached
 * profile + suggested users, then opens or creates a conversation and
 * sends a structured "shared post" message body. The receiving thread
 * renders a normal text bubble — V1 doesn't render rich post previews
 * inside chat (a future enhancement). The body includes the post id so
 * future versions can deep-link.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { conversationApi, useApiClient, userApi } from "@/utils/api";
import type { Conversation, Post, User } from "@/types";

export interface ShareToChatSheetProps {
  post: Post | null;
  onClose: () => void;
}

interface ShareTarget extends User {
  /** True when there's a mutual follow with the current user. */
  isFriend: boolean;
}

function ShareToChatSheetImpl({ post, onClose }: ShareToChatSheetProps) {
  const router = useRouter();
  const { colors, radii } = useTheme();
  const api = useApiClient();
  const { currentUser } = useCurrentUser();
  // Native alert because this component is itself a Modal — nested
  // <Modal> wouldn't show.
  const { showSuccess, showError } = useCustomAlert({ useNative: true });

  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Sources: people I follow + people who follow me. Either side covers
  // the user's expectation of "send to a friend". `enabled` keys off the
  // current user so we don't fire requests before auth resolves; the
  // tuple shape stays constant so TanStack's overload narrows correctly.
  const username = currentUser?.username ?? "";
  const followsQueries = useQueries({
    queries: [
      {
        queryKey: ["user-list", username, "following"],
        queryFn: async (): Promise<User[]> => {
          const r = await userApi.getFollowing<User>(api, username);
          return r.data.users ?? [];
        },
        enabled: !!username,
        staleTime: 60_000,
      },
      {
        queryKey: ["user-list", username, "followers"],
        queryFn: async (): Promise<User[]> => {
          const r = await userApi.getFollowers<User>(api, username);
          return r.data.users ?? [];
        },
        enabled: !!username,
        staleTime: 60_000,
      },
    ],
  });

  const isLoading = followsQueries.some((q) => q.isLoading);

  const targets = useMemo<ShareTarget[]>(() => {
    const following: User[] = followsQueries[0]?.data ?? [];
    const followers: User[] = followsQueries[1]?.data ?? [];
    const followingIds = new Set(following.map((u) => u._id));
    const followerIds = new Set(followers.map((u) => u._id));

    const merged = new Map<string, ShareTarget>();
    for (const u of following) {
      merged.set(u._id, { ...u, isFriend: followerIds.has(u._id) });
    }
    for (const u of followers) {
      if (merged.has(u._id)) continue;
      merged.set(u._id, { ...u, isFriend: followingIds.has(u._id) });
    }
    // Friends first, then by name.
    return Array.from(merged.values()).sort((a, b) => {
      if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [followsQueries]);

  const visible = !!post;

  // Reset transient state on close.
  useEffect(() => {
    if (!visible) setSendingTo(null);
  }, [visible]);

  const handleSendTo = useCallback(
    async (target: ShareTarget) => {
      if (!post || sendingTo) return;
      setSendingTo(target._id);
      try {
        const conversation = await conversationApi
          .createOrGet<Conversation>(api, target._id)
          .then((r) => r.data.conversation);
        if (!conversation?._id) throw new Error("missing conversation id");

        const author = `@${post.user.username}`;
        const preview = post.content
          ? post.content.length > 200
            ? `${post.content.slice(0, 200)}…`
            : post.content
          : post.image
          ? "[image]"
          : "[post]";
        const body = `Shared a post by ${author}:\n${preview}\n\n#xmind/post/${post._id}`;
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        await conversationApi.sendMessage(api, conversation._id, { body, clientId });
        onClose();
        showSuccess(
          "Sent",
          `Post sent to ${target.firstName}. Open the chat to keep talking.`
        );
        router.push({
          pathname: "/messages/[conversationId]",
          params: { conversationId: conversation._id },
        });
      } catch {
        showError(
          "Couldn't send",
          "Network blip — try again. Your message wasn't sent."
        );
      } finally {
        setSendingTo(null);
      }
    },
    [api, onClose, post, router, sendingTo, showError, showSuccess]
  );

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        className="flex-1"
        // overlay.scrim is a translucent black — not in tailwind config.
        style={{ backgroundColor: colors.overlay.scrim }}
      >
        <Pressable
          accessibilityLabel="Dismiss share sheet"
          onPress={onClose}
          className="flex-1"
        />

        <SafeAreaView edges={["bottom"]}>
          <View className="px-base pb-sm">
            <Surface
              variant="solid"
              radius={radii.xxl}
              className="overflow-hidden border border-subtle max-h-[520px]"
            >
              {/* Handle bar */}
              <View className="items-center pt-sm pb-xs">
                <View
                  className="w-10 h-1 rounded-[2px]"
                  style={{ backgroundColor: colors.border.strong }}
                />
              </View>

              <View className="w-full flex-row items-center px-lg py-sm gap-md border-b-[0.5px] border-subtle">
                <View className="flex-1">
                  <Text variant="title" tone="primary">
                    Send to a friend
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {targets.length} {targets.length === 1 ? "person" : "people"}
                  </Text>
                </View>
                <IconButton accessibilityLabel="Close" onPress={onClose} variant="filled">
                  <Feather name="x" size={18} color={colors.text.primary} />
                </IconButton>
              </View>

              {isLoading ? (
                <View className="py-xl items-center">
                  <ActivityIndicator color={colors.tint.primary} />
                </View>
              ) : targets.length === 0 ? (
                <EmptyState
                  icon={<Feather name="users" size={26} color={colors.tint.primary} />}
                  title="No one to send to yet"
                  description="Follow some people, and the option to send a post to them lands here."
                />
              ) : (
                <View className="pt-sm">
                  {targets.map((t) => (
                    <Pressable
                      key={t._id}
                      onPress={() => handleSendTo(t)}
                      disabled={!!sendingTo}
                      android_ripple={{ color: colors.overlay.press }}
                      accessibilityRole="button"
                      accessibilityLabel={`Send to ${t.firstName} ${t.lastName}`}
                      className={sendingTo === t._id ? "opacity-70" : ""}
                    >
                      <Card
                        variant="solid"
                        className="mx-base mb-sm p-base border border-subtle"
                      >
                        <View className="flex-row items-center gap-md">
                          <Avatar
                            source={t.profilePicture}
                            name={`${t.firstName} ${t.lastName}`}
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
                                {t.firstName} {t.lastName}
                              </Text>
                              {t.verified ? <VerifiedBadge size={13} /> : null}
                              {t.isFriend ? (
                                <View className="flex-row items-center px-[6px] py-[1px] rounded-pill ml-xs bg-tint/10">
                                  <Feather
                                    name="users"
                                    size={9}
                                    color={colors.tint.primary}
                                  />
                                  <Text
                                    variant="caption"
                                    tone="tint"
                                    weight="700"
                                    className="ml-[3px]"
                                  >
                                    Friend
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <Text
                              variant="caption"
                              tone="tertiary"
                              numberOfLines={1}
                            >
                              @{t.username}
                            </Text>
                          </View>
                          {sendingTo === t._id ? (
                            <ActivityIndicator color={colors.tint.primary} />
                          ) : (
                            <Feather
                              name="send"
                              size={18}
                              color={colors.tint.primary}
                            />
                          )}
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              )}
            </Surface>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const ShareToChatSheet = memo(ShareToChatSheetImpl);
ShareToChatSheet.displayName = "ShareToChatSheet";

export default ShareToChatSheet;
