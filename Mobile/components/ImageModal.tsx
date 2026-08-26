import React, { memo } from "react";
import { Modal, Pressable, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";

export interface ImageModalProps {
  isVisible: boolean;
  onClose: () => void;
  imageUrl: string;
  imageTitle?: string;
}

/**
 * Full-bleed image viewer.
 * Black background regardless of theme — focuses the eye on the image
 * exactly the way platform photo viewers do.
 */
function ImageModalImpl({ isVisible, onClose, imageUrl, imageTitle }: ImageModalProps) {
  const { spacing } = useTheme();
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <IconButton accessibilityLabel="Close" onPress={onClose} variant="filled">
              <Feather name="x" size={20} color="#fff" />
            </IconButton>
            {imageTitle ? (
              <Text variant="subtitle" style={{ color: "#fff" }} numberOfLines={1}>
                {imageTitle}
              </Text>
            ) : null}
          </View>

          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss">
            <ExpoImage
              source={{ uri: imageUrl }}
              style={{ flex: 1, width: "100%" }}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={200}
            />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const ImageModal = memo(ImageModalImpl);
ImageModal.displayName = "ImageModal";

export default ImageModal;
