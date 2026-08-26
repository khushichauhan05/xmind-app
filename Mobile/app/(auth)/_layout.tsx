import { Redirect, Stack } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { StatusBar } from "expo-status-bar";

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null; // or a splash/loading component
  }

  if (isSignedIn) {
    return <Redirect href={"/(tabs)"} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
      initialRouteName="index"
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Welcome",
          gestureEnabled: false, // Prevent going back from welcome
        }}
      />
      <Stack.Screen
        name="sign-in"
        options={{
          title: "Sign In",
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
