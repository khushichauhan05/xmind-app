import React, { memo, useCallback, useEffect, useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useTheme } from "@/hooks/useTheme";
import { useUsernameUpdate } from "@/hooks/useUsernameUpdate";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";

export interface UsernameEditModalProps {
  visible: boolean;
  currentUsername: string;
  onClose: () => void;
}

/**
 * Username editor with real-time availability check.
 *
 * As the user types, `useUsernameAvailability` debounces the input by
 * 350 ms then asks the backend whether the handle is free. The trailing
 * indicator inside the field flips between checking / available / taken.
 */
function UsernameEditModalImpl({
  visible,
  currentUsername,
  onClose,
}: UsernameEditModalProps) {
  const { colors, spacing, radii } = useTheme();
  const { updateUsername, isUpdating } = useUsernameUpdate();
  const [next, setNext] = useState(currentUsername);

  useEffect(() => {
    if (visible) setNext(currentUsername);
  }, [currentUsername, visible]);

  const availability = useUsernameAvailability(next, currentUsername);

  const error =
    availability.status === "invalid"
      ? availability.message
      : availability.status === "taken"
      ? availability.message ?? "That handle is taken."
      : undefined;

  const helper =
    availability.status === "checking"
      ? "Checking availability…"
      : availability.status === "available"
      ? availability.message ?? "Available"
      : "Letters, numbers, underscores. 3–30 characters.";

  const canSave =
    availability.status === "available" &&
    next.trim().toLowerCase() !== currentUsername.toLowerCase();

  const onSave = useCallback(async () => {
    if (!canSave) return;
    await updateUsername(next.trim());
    onClose();
  }, [canSave, next, onClose, updateUsername]);

  const trailingIcon = (() => {
    if (availability.status === "checking") {
      return <Feather name="loader" size={16} color={colors.text.tertiary} />;
    }
    if (availability.status === "available") {
      return <Feather name="check-circle" size={16} color={colors.tint.success} />;
    }
    if (availability.status === "taken" || availability.status === "invalid") {
      return <Feather name="x-circle" size={16} color={colors.tint.danger} />;
    }
    return null;
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <SafeAreaView style={{ width: "100%", alignItems: "center" }}>
          <Surface
            variant="solid"
            radius={radii.xl}
            style={{
              width: "100%",
              maxWidth: 360,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border.subtle,
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Text variant="title" tone="primary" style={{ flex: 1 }}>
                Edit username
              </Text>
              <IconButton accessibilityLabel="Close" onPress={onClose}>
                <Feather name="x" size={20} color={colors.text.primary} />
              </IconButton>
            </View>

            <Text variant="bodySm" tone="secondary">
              Your @handle. People use it to find you and tag you.
            </Text>

            <TextField
              value={next}
              onChangeText={(t) => setNext(t.toLowerCase())}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
              helper={error ? undefined : helper}
              trailing={trailingIcon}
            />

            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                justifyContent: "flex-end",
                marginTop: spacing.sm,
              }}
            >
              <Button label="Cancel" variant="secondary" onPress={onClose} />
              <Button
                label="Save"
                loading={isUpdating}
                disabled={!canSave}
                onPress={onSave}
              />
            </View>
          </Surface>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const UsernameEditModal = memo(UsernameEditModalImpl);
UsernameEditModal.displayName = "UsernameEditModal";

export default UsernameEditModal;
