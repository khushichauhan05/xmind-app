/**
 * StoryViewer — full-screen image preview with a 5-second progress bar.
 *
 * Lever: time-bounded curiosity loop.
 *  IG-style automatic advance maintains the rhythm of casual viewing.
 *  Tap-left/tap-right lets the user skip or backtrack without lifting
 *  the thumb, matching the universal Stories gesture vocabulary.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import type { Post, User } from "@/types";

const STORY_DURATION_MS = 5000;

export interface StoryViewerProps {
  stories: { user: User; post?: Post }[];
  startIndex: number | null;
  onClose: () => void;
}

function StoryViewerImpl({ stories, startIndex, onClose }: StoryViewerProps) {
  const { colors } = useTheme();
  const [index, setIndex] = useState<number>(startIndex ?? 0);
  const progress = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = startIndex != null;
  const total = stories.length;

  useEffect(() => {
    if (startIndex != null) setIndex(startIndex);
  }, [startIndex]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= total) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [onClose, total]);

  // Drive the progress bar + auto-advance whenever the active story changes.
  useEffect(() => {
    if (!isOpen) return;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: STORY_DURATION_MS,
      easing: Easing.linear,
    });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advance, STORY_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [advance, index, isOpen, progress]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const current = useMemo(
    () => (isOpen ? stories[index] : null),
    [index, isOpen, stories]
  );

  if (!current) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <RNStatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Image */}
        {current.post?.image ? (
          <ExpoImage
            source={{ uri: current.post.image }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={140}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors.surface.sunken,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Avatar
              source={current.user.profilePicture}
              name={`${current.user.firstName} ${current.user.lastName}`}
              size={120}
            />
            <Text
              variant="title"
              style={{ color: "#fff", marginTop: 24 }}
            >
              {current.user.firstName} {current.user.lastName}
            </Text>
            <Text variant="body" style={{ color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              No story image yet
            </Text>
          </View>
        )}

        {/* Top gradient + progress segments + identity */}
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160 }}
        />
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 12,
            right: 12,
            flexDirection: "row",
            gap: 4,
          }}
        >
          {stories.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.3)",
                overflow: "hidden",
              }}
            >
              {i < index ? (
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#fff",
                  }}
                />
              ) : i === index ? (
                <Animated.View
                  style={[
                    {
                      height: "100%",
                      backgroundColor: "#fff",
                    },
                    progressStyle,
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>

        <View
          style={{
            position: "absolute",
            top: 64,
            left: 16,
            right: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Avatar
            source={current.user.profilePicture}
            name={`${current.user.firstName} ${current.user.lastName}`}
            size={36}
          />
          <View style={{ flex: 1 }}>
            <Text
              variant="subtitle"
              style={{ color: "#fff" }}
              numberOfLines={1}
            >
              {current.user.firstName} {current.user.lastName}
            </Text>
            <Text variant="caption" style={{ color: "rgba(255,255,255,0.7)" }}>
              @{current.user.username}
            </Text>
          </View>
          <IconButton accessibilityLabel="Close story" onPress={onClose}>
            <Feather name="x" size={22} color="#fff" />
          </IconButton>
        </View>

        {/* Tap zones */}
        <Pressable
          onPress={goPrev}
          style={{
            position: "absolute",
            top: 100,
            bottom: 0,
            left: 0,
            width: "30%",
          }}
          accessibilityLabel="Previous story"
          accessibilityRole="button"
        />
        <Pressable
          onPress={advance}
          style={{
            position: "absolute",
            top: 100,
            bottom: 0,
            right: 0,
            width: "70%",
          }}
          accessibilityLabel="Next story"
          accessibilityRole="button"
        />
      </View>
    </Modal>
  );
}

export const StoryViewer = memo(StoryViewerImpl);
StoryViewer.displayName = "StoryViewer";

export default StoryViewer;
