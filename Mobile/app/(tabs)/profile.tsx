/**
 * Profile (current user) — FB-style header + IG-style media grid.
 *
 * Lever: peak-end + identity reinforcement.
 *  Cover image up top, avatar overlapped below — the FB pattern of
 *  treating the profile as a personal stage. The 3-column media grid
 *  is the IG move that turns the profile into a portfolio at a glance.
 *  Twitter-style "Posts" tab is preserved for the verbal feed.
 *
 * Hierarchy (top → bottom):
 *  1. Top bar (display name + sign out).
 *  2. Cover photo (3:1).
 *  3. Avatar overlap + identity card (name, handle, bio, meta, stats).
 *  4. Verification progress (kept as-is — strong existing affordance).
 *  5. Profile tabs (Posts / Media / Replies / Likes).
 *  6. Tab content. Media tab swaps the timeline for a 3-col grid.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { Feather } from "@expo/vector-icons";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import EditProfileModal from "@/components/EditProfileModal";
import PostsList from "@/components/PostsList";
import ProfileTabs, { type ProfileTab } from "@/components/ProfileTabs";
import SignOutButton from "@/components/SignOutButton";
import VerificationProgress from "@/components/VerificationProgress";
import ImageModal from "@/components/ImageModal";

import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { usePosts } from "@/hooks/usePosts";
import { useProfile } from "@/hooks/useProfile";
import { formatNumber } from "@/utils/formatter";

export default function ProfileScreen() {
  const { colors, spacing, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { currentUser, isLoading } = useCurrentUser();
  const { posts: userPosts, refetch: refetchPosts } = usePosts(
    currentUser?.username
  );

  const {
    isEditModalVisible,
    openEditModal,
    closeEditModal,
    formData,
    saveProfile,
    updateFormField,
    isUpdating,
    refetch: refetchProfile,
    selectedProfileImage,
    selectedBannerImage,
    pickImageFromGallery,
    takePhoto,
    removeImage,
    verificationResult,
    handleAutoVerification,
    getVerificationProgressValue,
    getVerificationStatusMessageValue,
    getVerificationRequirementsValue,
    isCheckingVerification,
    usernameValidation,
    usernameValidate,
    usernameValidateErrors,
  } = useProfile();

  const { showInfo, showError } = useCustomAlert({ useNative: true });

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchPosts()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchPosts, refetchProfile]);

  const handleVerificationRequest = useCallback(async () => {
    try {
      const isEligible = verificationResult?.isEligible || false;
      if (isEligible) {
        await handleAutoVerification();
      } else {
        const reqs = (getVerificationRequirementsValue() ?? []).join("\n• ");
        showInfo(
          "Almost there",
          `Finish these and we'll verify you automatically:\n\n• ${reqs}`
        );
      }
    } catch {
      showError("Request failed", "Try again in a moment.");
    }
  }, [
    getVerificationRequirementsValue,
    handleAutoVerification,
    showError,
    showInfo,
    verificationResult,
  ]);

  const mediaPosts = useMemo(
    () => (userPosts ?? []).filter((p) => !!p.image),
    [userPosts]
  );

  const tabContent = useMemo(() => {
    if (!currentUser) return null;
    if (activeTab === "posts") {
      return <PostsList username={currentUser.username} />;
    }
    if (activeTab === "media") {
      if (mediaPosts.length === 0) {
        return (
          <EmptyState
            icon={<Feather name="image" size={26} color={colors.tint.primary} />}
            title="No media yet"
            description="Post a photo and it'll show up here in a clean grid."
          />
        );
      }
      return (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 1,
          }}
        >
          {mediaPosts.map((p) => (
            <Pressable
              key={p._id}
              onPress={() => p.image && setPreviewUrl(p.image)}
              style={{ width: "33.3%", aspectRatio: 1, padding: 1 }}
              accessibilityRole="button"
              accessibilityLabel="Open photo"
            >
              <ExpoImage
                source={{ uri: p.image! }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            </Pressable>
          ))}
        </View>
      );
    }
    if (activeTab === "replies") {
      return (
        <EmptyState
          icon={<Feather name="message-circle" size={26} color={colors.tint.primary} />}
          title="Replies, soon"
          description="A dedicated thread of every conversation you're in is on the way. Until then, your replies live under each post."
        />
      );
    }
    return (
      <EmptyState
        icon={<Feather name="heart" size={26} color={colors.tint.primary} />}
        title="Likes are private — for now"
        description="Your liked posts will land here in a future update with a privacy toggle."
      />
    );
  }, [activeTab, colors.tint.primary, currentUser, mediaPosts]);

  if (isLoading || !currentUser?._id) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
        <SafeAreaView edges={["top"]}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              gap: spacing.md,
            }}
          >
            <Skeleton width="100%" height={200} radius={16} />
            <Skeleton width="50%" height={20} />
            <Skeleton width="40%" height={14} />
            <Skeleton width="100%" height={64} radius={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const joined = currentUser.createdAt
    ? format(new Date(currentUser.createdAt), "MMMM yyyy")
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.bg.canvas }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="title" tone="primary" numberOfLines={1}>
              {currentUser.firstName} {currentUser.lastName}
            </Text>
            <Text variant="bodySm" tone="secondary">
              @{currentUser.username}
            </Text>
          </View>
          <SignOutButton />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tint.primary}
            colors={[colors.tint.primary]}
          />
        }
      >
        {/* FB-style cover */}
        <Pressable
          onPress={() => setPreviewUrl(currentUser.bannerImage ?? null)}
          disabled={!currentUser.bannerImage}
        >
          <ExpoImage
            source={
              currentUser.bannerImage
                ? { uri: currentUser.bannerImage }
                : require("../../assets/images/default-banner.jpeg")
            }
            style={{ width: "100%", aspectRatio: 3 / 1 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        </Pressable>

        {/* Identity block — avatar overlaps the bottom of the cover. */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: -56,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                borderWidth: 4,
                borderColor: colors.bg.canvas,
                borderRadius: 56,
              }}
            >
              <Avatar
                source={currentUser.profilePicture}
                name={`${currentUser.firstName} ${currentUser.lastName}`}
                size={104}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, paddingBottom: spacing.sm }}>
              <Button
                label="Saved"
                variant="ghost"
                size="sm"
                leading={
                  <Feather name="bookmark" size={14} color={colors.tint.primary} />
                }
                onPress={() => router.push("/saved")}
              />
              <Button
                label="Edit profile"
                variant="secondary"
                size="sm"
                onPress={openEditModal}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text variant="title" tone="primary" numberOfLines={1}>
              {currentUser.firstName} {currentUser.lastName}
            </Text>
            {currentUser.verified ? <VerifiedBadge size={18} /> : null}
          </View>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
            @{currentUser.username}
          </Text>

          {currentUser.bio ? (
            <Text variant="body" tone="primary" style={{ marginTop: spacing.md }}>
              {currentUser.bio}
            </Text>
          ) : (
            <Text
              variant="body"
              tone="tertiary"
              style={{ marginTop: spacing.md, fontStyle: "italic" }}
            >
              Add a one-line bio so people know who they're following.
            </Text>
          )}

          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            {currentUser.location ? (
              <MetaRow icon="map-pin" label={currentUser.location} />
            ) : null}
            {joined ? <MetaRow icon="calendar" label={`Joined ${joined}`} /> : null}
          </View>

          {/* Stats — tapping Following / Followers opens the list.
              `width: '100%'` + `justifyContent: 'space-between'` keeps the
              three slots distributed evenly even if a parent's flex
              context is non-obvious. */}
          <View
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "stretch",
              justifyContent: "space-around",
              marginTop: spacing.lg,
              borderRadius: radii.lg,
              backgroundColor: colors.surface.secondary,
              borderWidth: 1,
              borderColor: colors.border.subtle,
              paddingVertical: spacing.md,
            }}
          >
            <Stat
              label="Following"
              value={formatNumber(currentUser.following?.length ?? 0)}
              onPress={() =>
                router.push({
                  pathname: "/followers/[username]",
                  params: { username: currentUser.username, mode: "following" },
                })
              }
            />
            <Divider />
            <Stat
              label="Followers"
              value={formatNumber(currentUser.followers?.length ?? 0)}
              onPress={() =>
                router.push({
                  pathname: "/followers/[username]",
                  params: { username: currentUser.username, mode: "followers" },
                })
              }
            />
            <Divider />
            <Stat label="Posts" value={formatNumber(userPosts?.length || 0)} />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.md }}>
          {/* VerificationProgress wraps itself in a Card already; nesting
              another one produced two visible borders. */}
          <VerificationProgress
            isVerified={currentUser.verified}
            progress={getVerificationProgressValue()}
            statusMessage={getVerificationStatusMessageValue()}
            isEligible={verificationResult?.isEligible || false}
            onVerificationRequest={handleVerificationRequest}
            isChecking={isCheckingVerification}
            missingRequirements={getVerificationRequirementsValue()}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <ProfileTabs active={activeTab} onChange={setActiveTab} />
          <View style={{ minHeight: 240 }}>{tabContent}</View>
        </View>
      </ScrollView>

      <EditProfileModal
        isVisible={isEditModalVisible}
        onClose={closeEditModal}
        formData={formData}
        saveProfile={saveProfile}
        updateFormField={updateFormField}
        isUpdating={isUpdating}
        selectedProfileImage={selectedProfileImage}
        selectedBannerImage={selectedBannerImage}
        pickImageFromGallery={pickImageFromGallery}
        takePhoto={takePhoto}
        removeImage={removeImage}
        usernameValidation={usernameValidation}
        usernameValidate={usernameValidate}
        usernameValidateErrors={usernameValidateErrors}
      />

      <ImageModal
        isVisible={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        imageUrl={previewUrl ?? ""}
        imageTitle="Photo"
      />
    </View>
  );
}

function MetaRow({
  icon,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Feather name={icon} size={14} color={colors.text.tertiary} />
      <Text variant="bodySm" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  // Explicit width over `flex: 1` so the row distribution survives stale
  // Metro caches and any platform quirks where flex weights drift.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="title" tone="primary" weight="800" align="center">
        {value}
      </Text>
      <Text variant="caption" tone="tertiary" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return (
    <View
      style={{ width: 1, alignSelf: "stretch", marginVertical: 4, backgroundColor: colors.border.subtle }}
    />
  );
}
