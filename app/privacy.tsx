import React from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeScreen } from "@/src/components/SafeScreen";
import { useAppTheme } from "@/src/hooks/useAppTheme";
import { useAuth } from "@/src/contexts/AuthContext";
import { PrivacyPolicyText, useAiConsent } from "@/src/privacy/AiConsentProvider";

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { approved, record, confirmed, review } = useAiConsent();
  const updated = record?.updatedAt as { toDate?: () => Date } | undefined;
  return <SafeScreen backgroundColor={colors.background}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/(auth)/welcome")}><Text style={{ color: colors.textPrimary }}>Back</Text></Pressable>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "700" }}>Privacy & AI</Text>
      {!!user && <View style={{ gap: 12 }}>
        <Text style={{ color: colors.textSecondary }}>{approved ? "AI sharing: accepted" : "AI sharing: off"}. {confirmed ? `Recorded choice: ${record?.status ?? "not set"}. Policy: ${record?.policyVersion ?? "not set"}.` : "Server status is not yet confirmed."}</Text>
        {!!updated?.toDate && <Text style={{ color: colors.textSecondary }}>Last changed: {updated.toDate().toLocaleString()}</Text>}
        <Pressable accessibilityRole="button" onPress={review} style={{ paddingVertical: 14 }}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>Review or revoke AI consent</Text></Pressable>
      </View>}
      <PrivacyPolicyText />
    </ScrollView>
  </SafeScreen>;
}
