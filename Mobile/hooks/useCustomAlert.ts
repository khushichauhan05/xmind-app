import { useCallback, useState } from "react";
import { Alert as NativeAlert } from "react-native";

import type { AlertButton } from "@/components/CustomAlert";

export interface CustomAlertOptions {
  title: string;
  message: string;
  buttons?: AlertButton[];
  type?: "default" | "success" | "error" | "warning" | "info";
}

export interface UseCustomAlertConfig {
  /**
   * Route alerts through React Native's native `Alert.alert()` instead of
   * the in-app custom modal.
   *
   * **When to set this true:** any hook whose `show*` calls might fire
   * while a `<Modal>` is open. React Native does not support stacked
   * Modals, and the custom alert is itself a Modal — so it would never
   * appear behind another open modal.
   *
   * Examples in this app: `useComments` (called from inside CommentsModal),
   * `useUsernameUpdate` (UsernameEditModal), `useProfile` (alerts can
   * fire while EditProfileModal is open).
   *
   * Hooks that always fire from a non-modal context (e.g. `useSignOut`
   * from a header) can leave this off and use the styled CustomAlert.
   */
  useNative?: boolean;
}

const mapButtonsForNative = (
  buttons: AlertButton[] | undefined
): {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}[] =>
  (buttons ?? [{ text: "OK" }]).map((b) => ({
    text: b.text,
    onPress: b.onPress,
    style:
      b.style === "destructive"
        ? "destructive"
        : b.style === "cancel"
        ? "cancel"
        : "default",
  }));

export const useCustomAlert = (config?: UseCustomAlertConfig) => {
  const useNative = config?.useNative ?? false;

  const [alertConfig, setAlertConfig] = useState<CustomAlertOptions | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showAlert = useCallback(
    (options: CustomAlertOptions) => {
      if (useNative) {
        // RN Alert is platform-native and stacks correctly over any open
        // Modal. We forfeit the custom styling here in exchange for the
        // alert actually being visible.
        NativeAlert.alert(
          options.title,
          options.message,
          mapButtonsForNative(options.buttons)
        );
        return;
      }
      setAlertConfig(options);
      setIsVisible(true);
    },
    [useNative]
  );

  const hideAlert = useCallback(() => {
    setIsVisible(false);
    setAlertConfig(null);
  }, []);

  const showSuccess = useCallback(
    (title: string, message: string, buttons?: AlertButton[]) => {
      showAlert({
        title,
        message,
        buttons: buttons || [{ text: "OK" }],
        type: "success",
      });
    },
    [showAlert]
  );

  const showError = useCallback(
    (title: string, message: string, buttons?: AlertButton[]) => {
      showAlert({
        title,
        message,
        buttons: buttons || [{ text: "OK" }],
        type: "error",
      });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (title: string, message: string, buttons?: AlertButton[]) => {
      showAlert({
        title,
        message,
        buttons: buttons || [{ text: "OK" }],
        type: "warning",
      });
    },
    [showAlert]
  );

  const showInfo = useCallback(
    (title: string, message: string, buttons?: AlertButton[]) => {
      showAlert({
        title,
        message,
        buttons: buttons || [{ text: "OK" }],
        type: "info",
      });
    },
    [showAlert]
  );

  const showConfirmation = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
      confirmText = "Confirm",
      cancelText = "Cancel"
    ) => {
      showAlert({
        title,
        message,
        buttons: [
          { text: cancelText, style: "cancel", onPress: onCancel },
          { text: confirmText, style: "default", onPress: onConfirm },
        ],
        type: "default",
      });
    },
    [showAlert]
  );

  const showDeleteConfirmation = useCallback(
    (title: string, message: string, onDelete: () => void, onCancel?: () => void) => {
      showAlert({
        title,
        message,
        buttons: [
          { text: "Cancel", style: "cancel", onPress: onCancel },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ],
        type: "warning",
      });
    },
    [showAlert]
  );

  const showSignOutConfirmation = useCallback(
    (
      title: string,
      message: string,
      signOut: () => void,
      onCancel?: () => void
    ) => {
      showAlert({
        title,
        message,
        buttons: [
          { text: "Cancel", style: "cancel", onPress: onCancel },
          { text: "Sign out", style: "destructive", onPress: signOut },
        ],
        type: "warning",
      });
    },
    [showAlert]
  );

  const showChoiceDialog = useCallback(
    (
      title: string,
      message: string,
      choices: Array<{ text: string; onPress: () => void }>,
      onCancel?: () => void,
      cancelText = "Cancel"
    ) => {
      const buttons: AlertButton[] = [
        ...choices.map((choice) => ({ text: choice.text, onPress: choice.onPress })),
        { text: cancelText, style: "cancel", onPress: onCancel },
      ];
      showAlert({ title, message, buttons, type: "info" });
    },
    [showAlert]
  );

  return {
    alertConfig,
    isVisible,
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation,
    showDeleteConfirmation,
    showChoiceDialog,
    showSignOutConfirmation,
  };
};
