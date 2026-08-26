import { User } from "@/types";
import { formatNumber } from "./formatter";

// Define constants for requirements
const MIN_POSTS = 1000;
const MIN_FOLLOWERS = 10000;
const CRITERIA_WEIGHTS = {
  hasProfilePicture: 0.25,
  hasBio: 0.25,
  hasLocation: 0.2,
  hasEnoughPosts: 0.15,
  hasEnoughFollowers: 0.15,
};

export interface VerificationCriteria {
  hasProfilePicture: boolean;
  hasBio: boolean;
  hasLocation: boolean;
  hasEnoughPosts: boolean;
  hasEnoughFollowers: boolean;
  isComplete: boolean;
}

export interface VerificationResult {
  isEligible: boolean;
  criteria: VerificationCriteria;
  missingRequirements: string[];
}

/**
 * Check if a user meets all criteria for automatic verification
 * @param user - User object containing profile information
 * @param postCount - Number of user posts (defaults to 0)
 * @returns Verification result with eligibility status and requirements
 */
export const checkVerificationEligibility = (
  user: User,
  postCount: number = 0
): VerificationResult => {
  const criteria: VerificationCriteria = {
    hasProfilePicture: Boolean(user.profilePicture?.trim()),
    hasBio: Boolean(user.bio?.trim()),
    hasLocation: Boolean(user.location?.trim()),
    hasEnoughPosts: postCount >= MIN_POSTS,
    hasEnoughFollowers: (user.followers?.length || 0) >= MIN_FOLLOWERS,
    isComplete: false,
  };

  // Check if all criteria are met (explicitly list fields to avoid relying on property order)
  const {
    hasProfilePicture,
    hasBio,
    hasLocation,
    hasEnoughPosts,
    hasEnoughFollowers,
  } = criteria;
  criteria.isComplete =
    hasProfilePicture &&
    hasBio &&
    hasLocation &&
    hasEnoughPosts &&
    hasEnoughFollowers;

  // Generate smart, actionable missing requirements
  const missingRequirements: string[] = [];
  const currentFollowers = user.followers?.length || 0;
  const remainingPosts = Math.max(0, MIN_POSTS - postCount);
  const remainingFollowers = Math.max(0, MIN_FOLLOWERS - currentFollowers);

  // Prioritize requirements by ease of completion and impact
  const requirementChecks = [
    {
      condition: !criteria.hasProfilePicture,
      message: "Add a profile picture",
      priority: 1,
      difficulty: "easy",
    },
    {
      condition: !criteria.hasBio,
      message: "Write a brief bio about yourself",
      priority: 2,
      difficulty: "easy",
    },
    {
      condition: !criteria.hasLocation,
      message: "Add your location",
      priority: 3,
      difficulty: "easy",
    },
    {
      condition: !criteria.hasEnoughPosts,
      message:
        remainingPosts === 1
          ? `Share 1 more thought (${formatNumber(postCount)}/${formatNumber(MIN_POSTS)})`
          : remainingPosts <= 3
            ? `Share ${remainingPosts} more thoughts (${formatNumber(postCount)}/${formatNumber(MIN_POSTS)})`
            : `Create ${remainingPosts} thoughts to reach ${formatNumber(MIN_POSTS)} posts`,
      priority: 4,
      difficulty: "medium",
    },
    {
      condition: !criteria.hasEnoughFollowers,
      message:
        remainingFollowers === 1
          ? `Get 1 more follower (${formatNumber(currentFollowers)}/${formatNumber(MIN_FOLLOWERS)})`
          : remainingFollowers <= 3
            ? `Get ${remainingFollowers} more followers (${formatNumber(currentFollowers)}/${formatNumber(MIN_FOLLOWERS)})`
            : `Reach ${formatNumber(MIN_FOLLOWERS)} followers to unlock verification`,
      priority: 5,
      difficulty: "hard",
    },
  ];

  // Sort by priority and add to missing requirements
  requirementChecks
    .filter((req) => req.condition)
    .sort((a, b) => a.priority - b.priority)
    .forEach((req) => {
      missingRequirements.push(req.message);
    });

  return {
    isEligible: criteria.isComplete,
    criteria,
    missingRequirements,
  };
};

/**
 * Get verification progress percentage (0-100)
 * @param user - User object containing profile information
 * @param postCount - Number of user posts (defaults to 0)
 * @returns Weighted progress percentage
 */
export const getVerificationProgress = (
  user: User,
  postCount: number = 0
): number => {
  const result = checkVerificationEligibility(user, postCount);
  let progress = 0;

  // Calculate weighted progress with bonus for completion
  for (const [key, value] of Object.entries(result.criteria)) {
    if (key !== "isComplete" && value) {
      progress += CRITERIA_WEIGHTS[key as keyof typeof CRITERIA_WEIGHTS] * 100;
    }
  }

  // Round to nearest 5 for cleaner UI display
  const roundedProgress = Math.round(progress / 5) * 5;

  // Ensure minimum progress of 5% if any criteria is met
  if (roundedProgress === 0 && progress > 0) {
    return 5;
  }

  // Cap at 100%
  return Math.min(100, roundedProgress);
};

/**
 * Get user-friendly verification status message
 * @param user - User object containing profile information
 * @param postCount - Number of user posts (defaults to 0)
 * @returns Formatted status message
 */
export const getVerificationStatusMessage = (
  user: User,
  postCount: number = 0
): string => {
  if (user.verified) {
    return "You're verified.";
  }

  const result = checkVerificationEligibility(user, postCount);
  const progress = getVerificationProgress(user, postCount);
  const remaining = result.missingRequirements.length;

  if (result.isEligible) {
    return "You're ready. Tap Request to get verified.";
  }

  // Goal-gradient phrasing: closer to the finish line, sharper the line.
  if (progress >= 80) {
    return `Almost there — ${remaining} ${remaining === 1 ? "step" : "steps"} left.`;
  } else if (progress >= 50) {
    return `Halfway there. ${remaining} ${remaining === 1 ? "thing" : "things"} left.`;
  } else if (progress >= 25) {
    return `Good start. ${remaining} ${remaining === 1 ? "thing" : "things"} left.`;
  } else {
    return "Finish your profile to start the path to verification.";
  }
};

/**
 * Get verification requirements summary
 * @param user - User object containing profile information
 * @param postCount - Number of user posts (defaults to 0)
 * @returns Array of user-friendly requirement messages
 */
export const getVerificationRequirements = (
  user: User,
  postCount: number = 0
): string[] => {
  return checkVerificationEligibility(user, postCount).missingRequirements;
};
