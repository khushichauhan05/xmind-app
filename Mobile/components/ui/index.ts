/**
 * Public surface of the design-system primitives. Screens import from
 * `@/components/ui` to keep call sites declarative and to make the
 * primitive set easy to audit and rename.
 */

export { Surface, type SurfaceProps, type SurfaceVariant } from "./Surface";
export { Text, type TextProps } from "./Text";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";
export { Avatar, type AvatarProps } from "./Avatar";
export { Card, type CardProps } from "./Card";
export { TextField, type TextFieldProps } from "./TextField";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ScreenHeader, type ScreenHeaderProps } from "./ScreenHeader";
