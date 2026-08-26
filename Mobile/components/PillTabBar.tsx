/**
 * 2026 Tab Bar — IG/FB hybrid bottom navigation.
 *
 * Lever: Fitts's Law + endowed-progress.
 *  The centred Create button is raised, larger, and gradient-filled — a
 *  thumb-sized target sitting where the dominant thumb naturally rests.
 *  Surfacing the create action at the apex of the bar removes the
 *  three-tap penalty social apps levy on posting and turns it into the
 *  most obvious motion in the app.
 *
 * Visual contract:
 *  - Five tabs: Home, Search, Create (centred + raised), Reels, Profile.
 *  - The 4 satellite tabs read like Instagram: outline icon at rest,
 *    filled black icon when active. Below the icon, no label at rest
 *    (Twitter/X minimalism). Active tab gets a small dot underneath.
 *  - The Create button is a 56px coral disc with a white plus, gently
 *    shadowed. Tapping it opens the create sheet (composer).
 *  - On Android the bar is opaque (no BlurView). On iOS the surface uses
 *    the platform glass primitive (Liquid Glass on iOS 26+).
 */
import React, { memo, useCallback, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";

import { Surface } from "@/components/ui/Surface";
import { useTheme } from "@/hooks/useTheme";
import { storyRingGradient } from "@/constants/tokens";

type FeatherGlyph = React.ComponentProps<typeof Feather>["name"];
type IoniconsGlyph = React.ComponentProps<typeof Ionicons>["name"];
type MciGlyph = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface RouteMeta {
  label: string;
  family: "feather" | "ion" | "mci";
  icon: FeatherGlyph | IoniconsGlyph | MciGlyph;
  iconActive: FeatherGlyph | IoniconsGlyph | MciGlyph;
}

const ROUTE_META: Record<string, RouteMeta> = {
  index: { label: "Home", family: "feather", icon: "home", iconActive: "home" },
  search: { label: "Search", family: "feather", icon: "search", iconActive: "search" },
  reels: {
    label: "Explore",
    family: "feather",
    icon: "compass",
    iconActive: "compass",
  },
  profile: {
    label: "Profile",
    family: "feather",
    icon: "user",
    iconActive: "user",
  },
};

const TAB_ORDER = ["index", "search", "create", "reels", "profile"] as const;

const TAB_HEIGHT = 64;
const CREATE_SIZE = 56;

interface IconProps {
  meta: RouteMeta;
  active: boolean;
  color: string;
}

function TabIcon({ meta, active, color }: IconProps) {
  if (meta.family === "feather") {
    return (
      <Feather
        name={(active ? meta.iconActive : meta.icon) as FeatherGlyph}
        size={26}
        color={color}
      />
    );
  }
  if (meta.family === "ion") {
    return (
      <Ionicons
        name={(active ? meta.iconActive : meta.icon) as IoniconsGlyph}
        size={26}
        color={color}
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name={(active ? meta.iconActive : meta.icon) as MciGlyph}
      size={28}
      color={color}
    />
  );
}

function PillTabBarImpl({ state, navigation }: BottomTabBarProps) {
  const { colors, spacing, mode } = useTheme();
  const insets = useSafeAreaInsets();

  // Order routes per TAB_ORDER. The "create" entry is virtual — it
  // doesn't correspond to a real route; tapping it opens a modal.
  const routes = useMemo(() => state.routes.filter((r) => ROUTE_META[r.name]), [
    state.routes,
  ]);

  const isFocusedFor = useCallback(
    (name: string) => {
      const focused = state.routes[state.index];
      return focused?.name === name;
    },
    [state.index, state.routes]
  );

  const onPressTab = useCallback(
    (routeName: string) => {
      const target = state.routes.find((r) => r.name === routeName);
      if (!target) return;
      const event = navigation.emit({
        type: "tabPress",
        target: target.key,
        canPreventDefault: true,
      });
      if (!isFocusedFor(routeName) && !event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => undefined);
        navigation.navigate(routeName);
      }
    },
    [isFocusedFor, navigation, state.routes]
  );

  const onPressCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() =>
      undefined
    );
    // The create flow is rendered as a stack screen at app root.
    navigation.navigate("create" as never);
  }, [navigation]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + spacing.sm,
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      {/* Outer wrapper holds the drop-shadow; the inner Surface handles
          clipping. Combining both on the same layer forces iOS to
          rasterise off-screen and the indicator spring drops frames. */}
      <View
        style={{
          shadowColor: "#000",
          shadowOpacity: mode === "dark" ? 0.45 : 0.16,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
          borderRadius: 999,
        }}
      >
        <Surface
          variant={Platform.OS === "ios" ? "glass" : "solid"}
          intensity={60}
          tintColor={mode === "dark" ? "#0E0E12" : "#FFFFFF"}
          radius={999}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 6,
            paddingHorizontal: 12,
            gap: 6,
            height: TAB_HEIGHT,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border.subtle,
            backgroundColor:
              Platform.OS === "android" ? colors.surface.raised : undefined,
          }}
        >
          {TAB_ORDER.map((slot) => {
            if (slot === "create") {
              return <CreateButton key="create" onPress={onPressCreate} />;
            }
            const meta = ROUTE_META[slot];
            const route = routes.find((r) => r.name === slot);
            if (!meta || !route)
              return <View key={slot} style={{ width: 52 }} />;
            const active = isFocusedFor(slot);
            return (
              <TabSatellite
                key={slot}
                meta={meta}
                active={active}
                onPress={() => onPressTab(slot)}
                color={active ? colors.text.primary : colors.text.secondary}
                indicatorColor={colors.tint.primary}
              />
            );
          })}
        </Surface>
      </View>
    </View>
  );
}

interface SatelliteProps {
  meta: RouteMeta;
  active: boolean;
  onPress: () => void;
  color: string;
  indicatorColor: string;
}

const SatelliteImpl = ({ meta, active, onPress, color, indicatorColor }: SatelliteProps) => {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 16, stiffness: 360, mass: 0.5 });
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 360, mass: 0.5 });
  }, [scale]);

  return (
    <Animated.View style={animated}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={meta.label}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={8}
        style={{
          width: 56,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TabIcon meta={meta} active={active} color={color} />
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            marginTop: 4,
            backgroundColor: active ? indicatorColor : "transparent",
          }}
        />
      </Pressable>
    </Animated.View>
  );
};

const TabSatellite = memo(SatelliteImpl);
TabSatellite.displayName = "TabSatellite";

function CreateButtonImpl({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 14, stiffness: 360, mass: 0.5 });
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 360, mass: 0.5 });
  }, [scale]);

  return (
    <Animated.View
      style={[
        {
          width: CREATE_SIZE,
          height: CREATE_SIZE,
          borderRadius: CREATE_SIZE / 2,
          shadowColor: colors.tint.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
          elevation: 10,
        },
        animated,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new post"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={6}
        style={{
          width: CREATE_SIZE,
          height: CREATE_SIZE,
          borderRadius: CREATE_SIZE / 2,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={storyRingGradient as unknown as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: CREATE_SIZE,
            height: CREATE_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="plus" size={28} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const CreateButton = memo(CreateButtonImpl);
CreateButton.displayName = "CreateButton";

export const PillTabBar = memo(PillTabBarImpl);
PillTabBar.displayName = "PillTabBar";

export default PillTabBar;
