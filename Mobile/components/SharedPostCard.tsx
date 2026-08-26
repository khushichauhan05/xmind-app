/**
 * SharedPostCard — compact in-chat preview of a post that was shared.
 *
 * Architectural role:
 *  When a user picks a friend from `ShareToChatSheet`, the message body
 *  carries a `#xmind/post/<postId>` marker. `MessageBubble` extracts the
 *  id and renders this card in place of the raw text — a tappable
 *  preview that opens the source post on press.
 *
 * Why a card, not a link:
 *  Plain-text URLs ("link") in chat ask the recipient to context-switch
 *  to a browser. A card preview keeps them in the thread, shows the
 *  author + content, and turns the share into a one-tap navigation.
 */
import React, { memo, useCallback } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { postApi, useApiClient } from "@/utils/api";
import type { Post } from "@/types";

export interface SharedPostCardProps {
  postId: string;
}

function SharedPostCardImpl({ postId }: SharedPostCardProps) {
  const router = useRouter();
  const api = useApiClient();
  const { colors } = useTheme();

  const { data: post, isLoading } = useQuery<Post | null>({
    queryKey: ["post", postId],
    queryFn: async () => {
      try {
        const r = await postApi.getPost<Post>(api, postId, { silent404: true });
        return r.data.post;
      } catch (e) {
        // A post the author deleted after sharing is the canonical
        // "expected" 404 here — we render an "unavailable" card and
        // suppress the noisy log via the silent404 flag above.
        const status = (e as AxiosError | undefined)?.response?.status;
        if (status === 404) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const onPress = useCallback(() => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  }, [router, postId]);

  if (isLoading) {
    return (
      <Card
        variant="solid"
        className="border border-subtle min-h-[88px] justify-center"
      >
        <Skeleton width="55%" height={12} />
        <Skeleton width="85%" height={12} className="mt-xs" />
        <Skeleton width="40%" height={12} className="mt-xs" />
      </Card>
    );
  }

  if (!post) {
    return (
      <Card variant="solid" className="border border-subtle">
        <Text variant="caption" tone="tertiary">
          Shared post is no longer available.
        </Text>
      </Card>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.overlay.press }}
      accessibilityRole="button"
      accessibilityLabel={`Open shared post by @${post.user.username}`}
    >
      <Card
        variant="solid"
        padding={0}
        className="border border-subtle overflow-hidden"
      >
        {post.image ? (
          <Image
            source={{ uri: post.image }}
            style={{ width: "100%", height: 140 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : null}
        <View className="p-base">
          <View className="flex-row items-center mb-xs">
            <Avatar
              source={post.user.profilePicture}
              name={`${post.user.firstName} ${post.user.lastName}`}
              size={28}
            />
            <View className="flex-1 min-w-0 ml-sm">
              <Text
                variant="caption"
                tone="primary"
                weight="700"
                numberOfLines={1}
              >
                {post.user.firstName} {post.user.lastName}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                @{post.user.username}
              </Text>
            </View>
          </View>
          {post.content ? (
            <Text variant="bodySm" tone="primary" numberOfLines={3}>
              {post.content}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export const SharedPostCard = memo(SharedPostCardImpl);
SharedPostCard.displayName = "SharedPostCard";

export default SharedPostCard;
