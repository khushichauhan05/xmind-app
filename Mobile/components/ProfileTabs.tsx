/**
 * ProfileTabs — Instagram-style icon segmented sub-nav.
 *
 * Why icons (not text labels):
 *  Earlier iterations used text labels at flex:1 in a row. At narrow
 *  widths the labels visually crammed against each other and made the
 *  bar feel "attached" — even when whitespace technically existed
 *  between tabs. Switching to glyphs eliminates that ambiguity entirely
 *  and matches the IG profile pattern exactly: four big touch targets,
 *  one indicator.
 *
 * Each glyph also carries an `accessibilityLabel` so screen readers
 * still get the tab name.
 */
import React, { memo, useCallback, useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";

export type ProfileTab = "posts" | "replies" | "media" | "likes";

interface TabDef {
  id: ProfileTab;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const TAB_DEFS: TabDef[] = [
  { id: "posts", label: "Posts", icon: "grid" },
  { id: "replies", label: "Replies", icon: "message-circle" },
  { id: "media", label: "Media", icon: "image" },
  { id: "likes", label: "Likes", icon: "heart" },
];

export interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (next: ProfileTab) => void;
}

function ProfileTabsImpl({ active, onChange }: ProfileTabsProps) {
  const { colors, spacing } = useTheme();
  const [tabWidth, setTabWidth] = useState(0);

  const indicatorX = useSharedValue(0);
  const tabIndex = Math.max(
    0,
    TAB_DEFS.findIndex((t) => t.id === active)
  );

  useEffect(() => {
    if (tabWidth > 0) {
      indicatorX.value = withSpring(tabIndex * tabWidth, {
        damping: 20,
        stiffness: 220,
        mass: 0.9,
      });
    }
  }, [indicatorX, tabIndex, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setTabWidth(w / TAB_DEFS.length);
  }, []);

  const onPressTab = useCallback(
    (id: ProfileTab) => {
      if (id === active) return;
      Haptics.selectionAsync().catch(() => undefined);
      onChange(id);
    },
    [active, onChange]
  );

  return (
    <View
      onLayout={onLayout}
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "stretch",
        justifyContent: "space-around",
        borderTopWidth: 0.5,
        borderTopColor: colors.border.subtle,
        backgroundColor: colors.bg.canvas,
        position: "relative",
      }}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              width: tabWidth,
              height: 2,
              backgroundColor: colors.tint.primary,
              
            },
            indicatorStyle,
          ]}
        />
      ) : null}

      {TAB_DEFS.map((tab) => {
        const focused = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onPressTab(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            android_ripple={{ color: colors.overlay.press }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: spacing.lg,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Feather
              name={tab.icon}
              size={22}
              color={focused ? colors.text.primary : colors.text.tertiary}
              style={{ paddingTop: spacing.md }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export const ProfileTabs = memo(ProfileTabsImpl);
ProfileTabs.displayName = "ProfileTabs";

export default ProfileTabs;
