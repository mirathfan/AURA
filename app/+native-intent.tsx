import { Linking, Platform } from "react-native";
import { isGoogleSignInActive } from "../src/auth/googleSession";
import { normalizeIncomingLink } from "../src/navigation/incomingLinks";

export async function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  let incoming = path;
  if (initial && Platform.OS === "ios") {
    // Router 6 uses ExpoLinking's synchronous registry on iOS. In the legacy
    // AppDelegate lifecycle it can be empty on launch; RN retains launchOptions.
    try {
      incoming = (await Linking.getInitialURL()) || path;
    } catch {
      // Preserve the Expo-provided URL if the native fallback is unavailable.
    }
  }
  return normalizeIncomingLink(incoming, {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    googleActive: isGoogleSignInActive(),
  });
}
