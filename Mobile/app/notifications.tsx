/**
 * Notifications — stack screen reachable from the home top-bar heart icon.
 *
 * Lever: cognitive economy + peak-end rule.
 *  Same-day groups compress the stack; the empty state names the next
 *  action ("post something to get your first reaction") so absence
 *  reads as encouragement, not as a dead end.
 */
import React, { useCallback, useMemo } from "react";
import { RefreshControl, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import GroupedNotificationCard, {
  type NotificationGroup,
} from "@/components/GroupedNotificationCard";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import { groupNotifications } from "@/utils/notificationGrouping";

export default function NotificationsScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, isLoading, error, refetch, isRefetching } =
    useNotifications();

  const groups = useMemo(
    () => groupNotifications(notifications),
    [notifications]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<NotificationGroup>) => (
      <GroupedNotificationCard group={item} />
    ),
    []
  );

  const keyExtractor = useCallback((item: NotificationGroup) => item.id, []);

  const Header = useCallback(
    ({ subtitle }: { subtitle?: string }) => (
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.bg.canvas }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <IconButton
            accessibilityLabel="Back"
            onPress={() => router.back()}
            variant="filled"
          >
            <Feather name="arrow-left" size={18} color={colors.text.primary} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Text variant="title" tone="primary">
              Activity
            </Text>
            {subtitle ? (
              <Text variant="bodySm" tone="secondary">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    ),
    [
      colors.bg.canvas,
      colors.border.subtle,
      colors.text.primary,
      router,
      spacing.lg,
      spacing.md,
    ]
  );

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        <Header />
        <EmptyState
          icon={<Feather name="alert-triangle" size={28} color={colors.tint.danger} />}
          title="Couldn't load activity"
          description="Probably the network. Try again in a moment."
          action={<Button label="Try again" onPress={() => refetch()} />}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        <Header />
        <View
          style={{
            paddingHorizontal: spacing.base,
            gap: spacing.md,
            marginTop: spacing.md,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: spacing.md,
                padding: spacing.base,
                borderRadius: 18,
                backgroundColor: colors.surface.primary,
                borderWidth: 1,
                borderColor: colors.border.subtle,
              }}
            >
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width="60%" height={12} />
                <Skeleton width="40%" height={10} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        <Header />
        <EmptyState
          icon={<Feather name="bell" size={28} color={colors.tint.primary} />}
          title="No activity yet — that's about to change"
          description="Post one short thought. The first reaction usually lands within an hour."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <Header
        subtitle={`${groups.length} ${groups.length === 1 ? "update" : "updates"}`}
      />
      <FlashList<NotificationGroup>
        data={groups}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingBottom: 80 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.tint.primary}
            colors={[colors.tint.primary]}
          />
        }
      />
    </View>
  );
}
