import React, { memo, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { User } from "@/types";

export interface UserSearchResultProps {
  user: User;
}

/**
 * Search-result row.
 * Tapping the row routes to the right profile (own vs. someone else's)
 * — symmetry the previous version got right and we preserve.
 */
function UserSearchResultImpl({ user }: UserSearchResultProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { currentUser } = useCurrentUser();

  const onPress = useCallback(() => {
    if (currentUser?._id === user._id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({
        pathname: "/user-profile",
        params: { userId: user._id, username: user.username },
      });
    }
  }, [currentUser?._id, router, user._id, user.username]);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.overlay.press }}
      className="flex-row items-center gap-md px-lg py-md border-t border-subtle"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Avatar
        source={user.profilePicture}
        name={`${user.firstName} ${user.lastName}`}
        size={48}
      />

      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-xs">
          <Text variant="subtitle" tone="primary" numberOfLines={1}>
            {user.firstName} {user.lastName}
          </Text>
          {user.verified ? <VerifiedBadge size={14} /> : null}
        </View>
        <Text variant="bodySm" tone="tertiary">
          @{user.username}
        </Text>
        {user.bio ? (
          <Text
            variant="bodySm"
            tone="secondary"
            numberOfLines={2}
            className="mt-[2px]"
          >
            {user.bio}
          </Text>
        ) : null}
      </View>

      <Feather name="chevron-right" size={18} color={colors.text.tertiary} />
    </Pressable>
  );
}

export const UserSearchResult = memo(UserSearchResultImpl, (prev, next) => prev.user._id === next.user._id);
UserSearchResult.displayName = "UserSearchResult";

export default UserSearchResult;
