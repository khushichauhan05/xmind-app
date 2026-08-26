import { useEffect, useCallback, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { usePosts } from "./usePosts";
import { useCustomAlert } from "./useCustomAlert";
import {
  checkVerificationEligibility,
  getVerificationProgress,
  getVerificationStatusMessage,
  getVerificationRequirements,
  VerificationResult,
} from "@/utils/verification";

export const useAutoVerification = () => {
  const { currentUser, refetch: refetchUser } = useCurrentUser();
  const { posts: userPosts } = usePosts(currentUser?.username);
  // Auto-verification can fire while EditProfileModal is open from the
  // Profile screen. Native Alert avoids the stacked-Modal problem.
  const { showSuccess, showInfo } = useCustomAlert({ useNative: true });
  // Verification is granted automatically by the backend once the profile
  // satisfies all requirements; the client just refetches to pick it up.
  const updateVerification = async (_value: boolean): Promise<boolean> => true;

  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [hasAttemptedAutoVerification, setHasAttemptedAutoVerification] =
    useState(false);

  // Handle automatic verification
  const handleAutoVerification = useCallback(async () => {
    if (
      !currentUser ||
      currentUser.verified ||
      !verificationResult?.isEligible
    ) {
      return;
    }
    const postCount = Array.isArray(userPosts) ? userPosts.length : 0;
    const { isEligible } = checkVerificationEligibility(currentUser, postCount);
    if (!isEligible) {
      return;
    }

    setIsChecking(true);

    try {
      // Automatically verify the user
      const success = await updateVerification(true);

      if (success) {
        // Refetch user data to get updated verification status
        await refetchUser();

        // Show success message
        showSuccess(
          "Account verified",
          "You've met all the requirements and your account is now verified."
        );
      }
    } catch (error) {
      console.error("Auto-verification failed:", error);
      showInfo(
        "Verification Update",
        "Your verification status will be updated shortly. Please refresh your profile."
      );
    } finally {
      setIsChecking(false);
    }
  }, [
    currentUser,
    verificationResult,
    updateVerification,
    refetchUser,
    showSuccess,
    showInfo,
    userPosts,
    isChecking,
  ]);

  // Check verification eligibility whenever user data changes
  useEffect(() => {
    if (currentUser && userPosts) {
      const result = checkVerificationEligibility(
        currentUser,
        userPosts.length
      );
      const progressValue = getVerificationProgress(
        currentUser,
        userPosts.length
      );

      setVerificationResult(result);
      setProgress(progressValue);

      // Auto-verify if eligible and not already verified
      if (
        result.isEligible &&
        !currentUser.verified &&
        !hasAttemptedAutoVerification
      ) {
        setHasAttemptedAutoVerification(true);
        handleAutoVerification();
      }
    }
  }, [
    currentUser,
    userPosts,
    hasAttemptedAutoVerification
  ]);

  // Manual verification check
  const checkVerification = useCallback(() => {
    if (currentUser && userPosts) {
      const result = checkVerificationEligibility(
        currentUser,
        userPosts.length
      );
      const progressValue = getVerificationProgress(
        currentUser,
        userPosts.length
      );

      setVerificationResult(result);
      setProgress(progressValue);

      return result;
    }
    return null;
  }, [currentUser, userPosts]);

  // Get verification status message
  const getStatusMessage = useCallback(() => {
    if (currentUser && userPosts) {
      return getVerificationStatusMessage(currentUser, userPosts.length);
    }
    return "";
  }, [currentUser, userPosts]);

  // Get missing requirements
  const getMissingRequirements = useCallback(() => {
    if (currentUser && userPosts) {
      return getVerificationRequirements(currentUser, userPosts.length);
    }
    return [];
  }, [currentUser, userPosts]);

  return {
    verificationResult,
    progress,
    isChecking,
    isEligible: verificationResult?.isEligible || false,
    isVerified: currentUser?.verified || false,
    statusMessage: getStatusMessage(),
    missingRequirements: getMissingRequirements(),
    checkVerification,
    handleAutoVerification,
  };
};
