import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useApiClient } from "@/utils/api";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { useCurrentUser } from "./useCurrentUser";

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  username?: string;
}

export const useProfileUpdate = () => {
  const [selectedProfileImage, setSelectedProfileImage] = useState<string | null>(null);
  const [selectedBannerImage, setSelectedBannerImage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateType, setUpdateType] = useState<"profilePicture" | "bannerImage" | null>(null);

  const api = useApiClient();
  const queryClient = useQueryClient();
  // Conservative default: this hook can be called from screens that
  // open profile-edit modals. Native Alert avoids stacked-Modal issues.
  const { showSuccess, showError, showInfo } = useCustomAlert({
    useNative: true,
  });
  const { refetch: refetchUser } = useCurrentUser();

  // Main profile update mutation (handles both text fields and images)
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: ProfileUpdateData) => {
      const formData = new FormData();

      // Add text fields
      Object.keys(profileData).forEach(key => {
        if (profileData[key as keyof ProfileUpdateData] !== undefined) {
          formData.append(key, profileData[key as keyof ProfileUpdateData] as string);
        }
      });

      // Handle profile picture upload
      if (selectedProfileImage) {
        const uriParts = selectedProfileImage.split(".");
        const fileType = uriParts[uriParts.length - 1].toLowerCase();

        const mimeTypeMap: Record<string, string> = {
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };
        const mimeType = mimeTypeMap[fileType] || "image/jpeg";
        const normalizedExt = mimeType.split("/")[1];

        formData.append("profilePicture", {
          uri: selectedProfileImage,
          name: `profile-image.${normalizedExt}`,
          type: mimeType,
        } as any);
      }

      // Handle banner image upload
      if (selectedBannerImage) {
        const uriParts = selectedBannerImage.split(".");
        const fileType = uriParts[uriParts.length - 1].toLowerCase();

        const mimeTypeMap: Record<string, string> = {
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };
        const mimeType = mimeTypeMap[fileType] || "image/jpeg";
        const normalizedExt = mimeType.split("/")[1];

        formData.append("bannerImage", {
          uri: selectedBannerImage,
          name: `banner-image.${normalizedExt}`,
          type: mimeType,
        } as any);
      }

      return api.post("/users/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      // Clear selected images
      setSelectedProfileImage(null);
      setSelectedBannerImage(null);
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      
      // Also refetch user data directly
      refetchUser();
      
      showSuccess("Success", "Profile updated successfully!");
    },
    onError: (error: any) => {
      console.error("Profile update error:", error);
      showError(
        "Error",
        error.response?.data?.error || "Failed to update profile"
      );
    },
  });

  // Username update mutation (separate endpoint)
  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const lowercaseUsername = username.toLowerCase();
      return api.put("/users/username", { username: lowercaseUsername });
    },
    onSuccess: () => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      refetchUser();
      showSuccess("Success", "Username updated successfully!");
    },
    onError: (error: any) => {
      console.error("Username update error:", error);
      showError(
        "Error",
        error.response?.data?.error || "Failed to update username"
      );
    },
  });

  // Request permissions for camera/gallery
  const requestPermissions = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== "granted") {
      const source = useCamera ? "camera" : "photo library";
      showInfo(
        "Permission needed",
        `Please grant permission to access your ${source}`
      );
      return false;
    }
    return true;
  };

  // Handle image picker for both profile and banner images
  const handleImagePicker = async (type: "profilePicture" | "bannerImage", useCamera: boolean = false) => {
    const hasPermission = await requestPermissions(useCamera);
    if (!hasPermission) return;

    const pickerOptions = {
      allowsEditing: true,
      aspect: type === "profilePicture" ? [1, 1] as [number, number] : [3, 1] as [number, number],
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

  // Pick image from gallery
  const pickImageFromGallery = (type: "profilePicture" | "bannerImage") => {
    handleImagePicker(type, false);
  };

  // Take photo with camera
  const takePhoto = (type: "profilePicture" | "bannerImage") => {
    handleImagePicker(type, true);
  };

  // Remove selected image
  const removeImage = (type: "profilePicture" | "bannerImage") => {
    if (type === "profilePicture") {
      setSelectedProfileImage(null);
    } else {
      setSelectedBannerImage(null);
    }
  };

  // Update profile with all fields (text + images)
  const updateProfile = async (profileData: ProfileUpdateData) => {
    // Check if we have any data to update
    const hasTextData = Object.values(profileData).some(value => value !== undefined);
    const hasImages = selectedProfileImage || selectedBannerImage;

    if (!hasTextData && !hasImages) {
      showInfo("No Changes", "Please make some changes before saving");
      return;
    }

    setIsUpdating(true);
    setUpdateType(selectedProfileImage ? "profilePicture" : selectedBannerImage ? "bannerImage" : null);

    try {
      await updateProfileMutation.mutateAsync(profileData);
    } finally {
      setIsUpdating(false);
      setUpdateType(null);
    }
  };

  // Update username separately
  const updateUsername = async (username: string) => {
    if (!username.trim()) {
      showError("Error", "Username cannot be empty");
      return false;
    }

    try {
      await updateUsernameMutation.mutateAsync(username);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Upload images and update profile (legacy function for backward compatibility)
  const uploadImagesAndUpdateProfile = async (profileData: ProfileUpdateData) => {
    return updateProfile(profileData);
  };

  return {
    // State
    selectedProfileImage,
    selectedBannerImage,
    isUpdating,
    updateType,

    // Functions
    updateProfile,
    updateUsername,
    uploadImagesAndUpdateProfile,
    pickImageFromGallery,
    takePhoto,
    removeImage,

    // Mutations (for external use if needed)
    updateProfileMutation,
    updateUsernameMutation,
  };
};
