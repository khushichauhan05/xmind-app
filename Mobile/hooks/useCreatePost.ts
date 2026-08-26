import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

import { postApi, useApiClient } from "@/utils/api";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import type { Post } from "@/types";

const MIME_FOR_EXT: Record<string, string> = {
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function buildImagePart(uri: string) {
  const parts = uri.split(".");
  const ext = (parts[parts.length - 1] ?? "jpg").toLowerCase();
  const mimeType = MIME_FOR_EXT[ext] ?? "image/jpeg";
  const normalizedExt = mimeType.split("/")[1] ?? "jpeg";
  return {
    uri,
    name: `image.${normalizedExt}`,
    type: mimeType,
    // The cast satisfies React Native's FormData polyfill, which accepts
    // a `{ uri, name, type }` object as a Blob-like value.
  } as unknown as Blob;
}

export const useCreatePost = () => {
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const api = useApiClient();
  const queryClient = useQueryClient();
  // PostComposer can be rendered inside modals (e.g. future create-post
  // sheet). Use native Alert so the success / error toast always appears.
  const { showSuccess, showError, showInfo } = useCustomAlert({
    useNative: true,
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; imageUri?: string }) => {
      const formData = new FormData();
      if (postData.content) formData.append("content", postData.content);
      if (postData.imageUri) {
        formData.append("image", buildImagePart(postData.imageUri));
      }
      const response = await postApi.createPost<Post>(api, formData);
      return response.data.post;
    },
    onSuccess: () => {
      setContent("");
      setSelectedImage(null);
      // Invalidate all feed shapes — home + this user's profile feed.
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts"] });
      showSuccess("Posted", "Your post is live in the feed.");
    },
    onError: () => {
      showError(
        "Couldn't post",
        "Your draft is still here. Try sending again in a moment."
      );
    },
  });

  const handleImagePicker = async (useCamera: boolean = false) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== "granted") {
      const source = useCamera ? "camera" : "photo library";
      showInfo(
        "Permission needed",
        `xMind needs access to your ${source} for this. Open Settings to allow it.`
      );
      return;
    }

    const pickerOptions = {
      allowsEditing: true,
      aspect: [16, 9] as [number, number],
      quality: 0.8,
    };

    const result = useCamera
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync({
          ...pickerOptions,
          mediaTypes: ["images"],
        });

    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const createPost = () => {
    if (!content.trim() && !selectedImage) {
      showInfo(
        "Nothing to post yet",
        "Write a line, add an image, or both — then tap Post."
      );
      return;
    }

    const postData: { content: string; imageUri?: string } = {
      content: content.trim(),
    };

    if (selectedImage) postData.imageUri = selectedImage;

    createPostMutation.mutate(postData);
  };

  return {
    content,
    setContent,
    selectedImage,
    isCreating: createPostMutation.isPending,
    pickImageFromGallery: () => handleImagePicker(false),
    takePhoto: () => handleImagePicker(true),
    removeImage: () => setSelectedImage(null),
    createPost,
  };
};
