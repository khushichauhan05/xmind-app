import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, userApi } from "../utils/api";
import { useCustomAlert } from "./useCustomAlert";

export const useUsernameUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const api = useApiClient();
  const queryClient = useQueryClient();
  // Always called from inside <UsernameEditModal> — native Alert avoids
  // the stacked-Modal restriction in React Native.
  const { showSuccess, showError, showInfo } = useCustomAlert({
    useNative: true,
  });

  const updateUsernameMutation = useMutation({
    mutationFn: (username: string) => userApi.updateUsername(api, username),
    onSuccess: (response: any) => {
      showSuccess(
        "Username updated",
        `Your handle is now @${response?.data?.user?.username ?? ""}.`
      );

      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });

      setIsUpdating(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error || "Try a different one in a moment.";
      showError("Couldn't update username", errorMessage);
      setIsUpdating(false);
    },
  });

  const updateUsername = async (newUsername: string) => {
    const candidate = (newUsername ?? "").trim();

    if (candidate.length === 0) {
      showError("Pick a username", "It can't be blank.");
      return false;
    }
    if (candidate.length < 4 || candidate.length > 15) {
      showError("Username length", "Use 4 to 15 characters.");
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(candidate)) {
      showError(
        "Invalid characters",
        "Letters, numbers, and underscores only."
      );
      return false;
    }
    if (candidate.startsWith("_") || candidate.endsWith("_")) {
      showError(
        "Watch the edges",
        "A username can't start or end with an underscore."
      );
      return false;
    }
    if (candidate.includes("__")) {
      showError("Trim the underscores", "No double underscores allowed.");
      return false;
    }
    const reservedWords = [
      "admin",
      "administrator",
      "moderator",
      "system",
      "root",
      "official",
      "support",
      "help",
      "twitter",
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
      "twitch",
      "discord",
      "reddit",
      "pinterest",
      "linkedin",
      "github",
      "gitlab",
      "bitbucket",
      "heroku",
      "vercel",
      "netlify",
    ];
    if (reservedWords.includes(candidate.toLowerCase())) {
      showError("Reserved word", "That handle is reserved — try another.");
      return false;
    }

    setIsUpdating(true);
    updateUsernameMutation.mutate(newUsername.trim());
    return true;
  };

  return {
    updateUsername,
    isUpdating,
    updateUsernameMutation,
  };
};
