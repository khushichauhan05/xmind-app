import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

import { useApiClient, userApi } from "@/utils/api";
import { useCurrentUser } from "./useCurrentUser";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { useExistingUsernames } from "./useExistingUsernames";
import {
  checkVerificationEligibility,
  getVerificationProgress,
  getVerificationStatusMessage,
  getVerificationRequirements,
  VerificationResult,
} from "@/utils/verification";
import { usePosts } from "./usePosts";
import { validateUsername } from "../utils/usernameValidation";
import type { User } from "@/types";

const MIME_FOR_EXT: Record<string, string> = {
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function buildImagePart(uri: string, fieldName: string) {
  const parts = uri.split(".");
  const ext = (parts[parts.length - 1] ?? "jpg").toLowerCase();
  const mimeType = MIME_FOR_EXT[ext] ?? "image/jpeg";
  const normalizedExt = mimeType.split("/")[1] ?? "jpeg";
  return {
    uri,
    name: `${fieldName}.${normalizedExt}`,
    type: mimeType,
  } as unknown as Blob;
}

export interface ProfileFormData {
  firstName: string;
  lastName: string;
  bio: string;
  location: string;
  username: string;
  profilePicture: string;
  bannerImage: string;
}

export const useProfile = () => {
  const api = useApiClient();
  // Profile screen renders <EditProfileModal>; alerts can fire while
  // that modal is open. Route through the native Alert so they actually
  // stack on top.
  const { showSuccess, showError, showInfo } = useCustomAlert({
    useNative: true,
  });
  const queryClient = useQueryClient();
  const { currentUser, refetch: refetchCurrentUser } = useCurrentUser();
  const { posts: userPosts } = usePosts(currentUser?.username);
  const { existingUsernames } = useExistingUsernames();

  // Modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Form data state
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: "",
    lastName: "",
    bio: "",
    location: "",
    username: "",
    profilePicture: "",
    bannerImage: "",
  });

  // Image states
  const [selectedProfileImage, setSelectedProfileImage] = useState<
    string | null
  >(null);
  const [selectedBannerImage, setSelectedBannerImage] = useState<string | null>(
    null
  );
  const [usernameValidate, setusernameValidate] = useState<boolean>(false);
  const [usernameValidateErrors, setusernameValidateErrors] = useState<string[]>(
    []
  );

  // Verification state
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  // Profile update mutation (text fields + images, single multipart request).
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: ProfileFormData) => {
      const formDataToSend = new FormData();

      if (profileData.firstName?.trim())
        formDataToSend.append("firstName", profileData.firstName.trim());
      if (profileData.lastName?.trim())
        formDataToSend.append("lastName", profileData.lastName.trim());
      if (profileData.bio?.trim())
        formDataToSend.append("bio", profileData.bio.trim());
      if (profileData.location?.trim())
        formDataToSend.append("location", profileData.location.trim());

      if (selectedProfileImage) {
        formDataToSend.append("profilePicture", buildImagePart(selectedProfileImage, "profile-image"));
      }
      if (selectedBannerImage) {
        formDataToSend.append("bannerImage", buildImagePart(selectedBannerImage, "banner-image"));
      }

      const response = await userApi.updateProfile<User>(api, formDataToSend);
      return response.data.user;
    },
    onSuccess: async (user) => {
      setSelectedProfileImage(null);
      setSelectedBannerImage(null);
      // Seed the auth cache directly so the UI updates without a
      // re-fetch round-trip. Then invalidate every query that holds a
      // denormalised copy of the user (avatar, name, verified) so the
      // updated picture / display name surfaces everywhere — feed,
      // profile feed, conversations, post detail, comments.
      queryClient.setQueryData<User>(["authUser"], user);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        queryClient.invalidateQueries({ queryKey: ["userPosts", user.username] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["comments"] }),
        queryClient.invalidateQueries({ queryKey: ["post"] }),
        queryClient.invalidateQueries({ queryKey: ["userProfile", user.username] }),
      ]);
      setIsEditModalVisible(false);
      showSuccess("Profile saved", "Your changes are live across the app.");
    },
    onError: (error: any) => {
      if (__DEV__) console.error("[profile] update error:", error);
      showError(
        "Couldn't save",
        error?.response?.data?.error ||
          "We couldn't save those changes. Try once more."
      );
    },
  });

  // Username update mutation (separate endpoint).
  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await userApi.updateUsername<User>(api, username.toLowerCase());
      return response.data.user;
    },
    onSuccess: async (user) => {
      queryClient.setQueryData<User>(["authUser"], user);
      await refetchCurrentUser();
      showSuccess("Username updated", "Your handle is live everywhere now.");
    },
    onError: (error: any) => {
      if (__DEV__) console.error("[profile] username update error:", error);
      showError(
        "Couldn't update username",
        error?.response?.data?.error || "Try a different one in a moment."
      );
    },
  });

  // Auto-verification mutation.
  const autoVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await userApi.autoVerifyUser<User>(api);
      return response.data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData<User>(["authUser"], user);
      showSuccess(
        "Account verified",
        "Your account is now verified — the badge appears on your profile."
      );
    },
    onError: (error: any) => {
      if (__DEV__) console.error("[profile] auto-verification failed:", error);
      showInfo("Almost there", "Your verification status will sync in a moment.");
    },
  });

  // Image picker functions
  const requestPermissions = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== "granted") {
      const source = useCamera ? "camera" : "photo library";
      showInfo(
        "Permission needed",
        `xMind needs access to your ${source} to use this. Open Settings to allow it.`
      );
      return false;
    }
    return true;
  };

  const handleImagePicker = async (
    type: "profilePicture" | "bannerImage",
    useCamera: boolean = false
  ) => {
    const hasPermission = await requestPermissions(useCamera);
    if (!hasPermission) return;

    const pickerOptions = {
      allowsEditing: true,
      aspect:
        type === "profilePicture"
          ? ([1, 1] as [number, number])
          : ([3, 1] as [number, number]),
      quality: 0.8,
    };

    const result = useCamera
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync({
          ...pickerOptions,
          mediaTypes: ["images"],
        });

    if (!result.canceled) {
      if (type === "profilePicture") {
        setSelectedProfileImage(result.assets[0].uri);
      } else {
        setSelectedBannerImage(result.assets[0].uri);
      }
    }
  };

  // Username validation
  const usernameValidation = async (username: string): Promise<boolean> => {
    const candidate = (username ?? "").trim();

    const result = await validateUsername(
      currentUser?.username ?? "",
      candidate,
      undefined,
      existingUsernames
    );
    if (result.valid) {
      setusernameValidate(true);
      setusernameValidateErrors([]);
      return true;
    } else {
      setusernameValidate(false);
      setusernameValidateErrors(result.errors);
      return false;
    }
  };

  // Verification functions
  const checkVerification = () => {
    if (currentUser) {
      // You would need to get post count from somewhere (maybe pass it as parameter)
      const result = checkVerificationEligibility(currentUser, 0);
      setVerificationResult(result);
      return result;
    }
    return null;
  };

  const handleAutoVerification = async () => {
    if (currentUser?.verified || !verificationResult?.isEligible) {
      return;
    }
    autoVerificationMutation.mutate();
  };

  const getVerificationProgressValue = () => {
    if (currentUser) {
      return getVerificationProgress(currentUser, userPosts?.length || 0);
    }
    return 0;
  };

  const getVerificationStatusMessageValue = () => {
    if (currentUser) {
      return getVerificationStatusMessage(currentUser, userPosts?.length || 0);
    }
    return "";
  };

  const getVerificationRequirementsValue = () => {
    if (currentUser) {
      return getVerificationRequirements(currentUser, userPosts?.length || 0);
    }
    return [];
  };

  // Modal functions
  const openEditModal = () => {
    if (currentUser) {
      setFormData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        bio: currentUser.bio || "",
        location: currentUser.location || "",
        username: currentUser.username || "",
        profilePicture: currentUser.profilePicture || "",
        bannerImage: currentUser.bannerImage || "",
      });

      // Clear any previously selected images
      setSelectedProfileImage(null);
      setSelectedBannerImage(null);
    }
    setIsEditModalVisible(true);
  };

  const closeEditModal = () => {
    setIsEditModalVisible(false);
    // Clear form data and selected images
    setSelectedProfileImage(null);
    setSelectedBannerImage(null);
  };

  // Form field update
  const updateFormField = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save profile function - handles all updates
  const saveProfile = async () => {
    // Check if username needs to be updated separately
    const usernameChanged = formData.username !== currentUser?.username;

    // Check if we have any profile data to update
    const hasTextData =
      formData.firstName ||
      formData.lastName ||
      formData.bio ||
      formData.location;
    const hasImages = selectedProfileImage || selectedBannerImage;

    if (!hasTextData && !hasImages && !usernameChanged) {
      showInfo("Nothing to save", "Edit something first, then tap Save.");
      return;
    }

    try {
      // Update username first if changed
      if (usernameChanged) {
        if (!usernameValidation(formData.username)) {
          return;
        }
        await updateUsernameMutation.mutateAsync(formData.username);
      }

      // Update profile data (including images) if there are changes
      if (hasTextData || hasImages) {
        await updateProfileMutation.mutateAsync(formData);
      }

      // If only username was changed and no other data, close modal manually
      if (usernameChanged && !hasTextData && !hasImages) {
        setIsEditModalVisible(false);
        showSuccess("Username updated", "Your handle is live everywhere now.");
      }
    } catch (error) {
      if (__DEV__) console.error("[profile] save error:", error);
    }
  };

  // Image functions
  const pickImageFromGallery = (type: "profilePicture" | "bannerImage") => {
    handleImagePicker(type, false);
  };

  const takePhoto = (type: "profilePicture" | "bannerImage") => {
    handleImagePicker(type, true);
  };

  const removeImage = (type: "profilePicture" | "bannerImage") => {
    if (type === "profilePicture") {
      setSelectedProfileImage(null);
    } else {
      setSelectedBannerImage(null);
    }
  };

  // Refetch function
  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["authUser"] });
    refetchCurrentUser();
  };

  return {
    // Modal state
    isEditModalVisible,
    openEditModal,
    closeEditModal,

    // Form data
    formData,
    updateFormField,

    // Save function
    saveProfile,
    isUpdating:
      updateProfileMutation.isPending || updateUsernameMutation.isPending,

    // Image functions
    selectedProfileImage,
    selectedBannerImage,
    pickImageFromGallery,
    takePhoto,
    removeImage,

    // Verification functions
    verificationResult,
    checkVerification,
    handleAutoVerification,
    getVerificationProgressValue,
    getVerificationStatusMessageValue,
    getVerificationRequirementsValue,
    isCheckingVerification: autoVerificationMutation.isPending,

    // Username functions
    usernameValidation,
    usernameValidate,
    usernameValidateErrors,
    existingUsernames, // New: Available usernames for validation
    // Utility
    refetch,
  };
};
