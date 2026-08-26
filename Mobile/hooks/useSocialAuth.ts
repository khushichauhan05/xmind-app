import { useSSO } from "@clerk/clerk-expo";
import { useState } from "react";
import { useCustomAlert } from "@/hooks/useCustomAlert";

export const useSocialAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { startSSOFlow } = useSSO();
  // Social auth runs over Clerk's web modal flow; our CustomAlert (a
  // Modal) wouldn't reliably stack on top. Use native Alert instead.
  const { showError } = useCustomAlert({ useNative: true });

  const handleSocialAuth = async (strategy: "oauth_google" | "oauth_apple") => {
    setIsLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.log("Error in social auth", err);
      const provider = strategy === "oauth_google" ? "Google" : "Apple";
      showError(
        "Sign-in didn't go through",
        `${provider} couldn't complete the sign-in. Try once more.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleSocialAuth };
};
