/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Colors } from "@/constants/theme";
import type { AuraLook } from "@/src/types/aura";
import AppImage from "@/src/components/common/AppImage";
import { AuraLookCard } from "./AuraLookCard";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/hooks/useReduceMotion", () => ({ useReduceMotion: () => true }));
jest.mock("@/src/hooks/useAppTheme", () => ({ useAppTheme: () => ({ colors: Colors.dark }) }));
jest.mock("@/src/components/common/AppImage", () => ({
  __esModule: true,
  default: (props: object) => React.createElement(require("react-native").Image, props),
}));
jest.mock("@/src/components/aura/AuraPressable", () => ({
  __esModule: true, default: require("react-native").Pressable,
}));
jest.mock("@/src/components/ui/auraStylePrimitives", () => ({
  auraDesignTokens: { radii: {} },
  AuraText: require("react-native").Text,
  AuraButton: require("react-native").Pressable,
  AuraIconButton: require("react-native").Pressable,
  AuraSheetBackdrop: require("react-native").View,
  AuraSheetSurface: require("react-native").View,
}));
jest.mock("./ItemDetailSheet", () => ({
  ItemDetailSheet: ({ item, visible }: { item?: { itemName: string }; visible: boolean }) =>
    visible ? <Text>{`Details: ${item?.itemName}`}</Text> : null,
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  Easing: { out: jest.fn(), cubic: jest.fn() },
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (value: unknown) => value,
  withDelay: (_delay: number, value: unknown) => value,
}));

function makeLook(imageUrl?: string): AuraLook {
  return {
    lookTitle: "Dinner edit", vibe: "Casual", shortExplanation: "An easy outfit.",
    pieces: [
      { role: "top", itemName: "White Oxford Shirt", source: "closet", itemId: "shirt", imageUrl },
      { role: "bottom", itemName: "Black Trousers", source: "closet", itemId: "pants" },
      { role: "shoes", itemName: "Brown Boots", source: "closet", itemId: "boots" },
    ],
    fromCloset: ["shirt", "pants", "boots"], addToComplete: [], alternates: [], actions: [],
  };
}

describe("outfit board image fallbacks", () => {
  it("keeps pieces without photos visible and opens their details", () => {
    const screen = render(<AuraLookCard look={makeLook()} hideActions />);
    expect(screen.getByText("White Oxford Shirt")).toBeTruthy();
    expect(screen.getByText("Black Trousers")).toBeTruthy();
    expect(screen.getByText("Brown Boots")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("View White Oxford Shirt details"));
    expect(screen.getByText("Details: White Oxford Shirt")).toBeTruthy();
  });

  it("shows a named fallback after an image fails and retries a replacement URL", () => {
    const screen = render(<AuraLookCard look={makeLook("https://example.com/old.png")} boardOnly />);
    fireEvent(screen.UNSAFE_getByType(AppImage), "error");
    expect(screen.getByText("White Oxford Shirt")).toBeTruthy();
    screen.rerender(<AuraLookCard look={makeLook("https://example.com/new.png")} boardOnly />);
    expect(screen.UNSAFE_getByType(AppImage).props.source.uri).toBe("https://example.com/new.png");
    expect(screen.queryByText("White Oxford Shirt")).toBeNull();
  });
});
