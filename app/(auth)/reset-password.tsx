import { router, useLocalSearchParams } from "expo-router";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { AuthInlineLink, AuthInput, AuthScaffold, PrimaryAuthButton } from "@/src/components/auth/AuthScaffold";
import { clearPasswordReset, getPasswordResetCode } from "@/src/auth/passwordResetAction";
import { auth } from "@/src/lib/firebase";
import { useAppTheme } from "@/src/hooks/useAppTheme";

export default function ResetPasswordScreen() {
  const { request } = useLocalSearchParams<{ request?: string | string[] }>();
  const id = typeof request === "string" ? request : undefined;
  const { colors } = useAppTheme();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"checking" | "ready" | "saving" | "invalid" | "done">("checking");
  const [message, setMessage] = useState("");
  const current = useRef(id);
  current.current = id;
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    current.current = id;
    setPassword("");
    setMessage("");
    setState("checking");
    const code = getPasswordResetCode(id);
    if (!code) setState("invalid");
    else void verifyPasswordResetCode(auth, code).then(
      () => { if (!cancelled) setState("ready"); },
      () => { if (!cancelled) setState("invalid"); },
    );
    return () => { cancelled = true; current.current = undefined; };
  }, [id]);

  async function onReset() {
    if (state !== "ready" || submitting.current) return;
    const code = getPasswordResetCode(id);
    if (!code) { setState("invalid"); return; }
    if (password.length < 6) { setMessage("Use at least 6 characters."); return; }
    submitting.current = true;
    setState("saving");
    setMessage("");
    try {
      await confirmPasswordReset(auth, code, password);
      clearPasswordReset(id);
      if (current.current === id) { setPassword(""); setState("done"); }
    } catch (error) {
      if (current.current !== id) return;
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === "auth/expired-action-code" || errorCode === "auth/invalid-action-code") {
        clearPasswordReset(id);
        setState("invalid");
      } else {
        setState("ready");
        setMessage(errorCode === "auth/weak-password" ? "Choose a stronger password." : "Unable to reset your password. Try again.");
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <AuthScaffold
      eyebrow="RESET ACCESS"
      title="Reset your password"
      subtitle={state === "done" ? "Your password has been updated." : "Choose a new password for your account."}
      footer={<AuthInlineLink label="Back to sign in" onPress={() => {
        clearPasswordReset(id);
        router.replace("/(auth)/login");
      }} />}
    >
      {state === "checking" && <Text style={{ color: colors.textSecondary }}>Checking your reset link…</Text>}
      {state === "invalid" && <>
        <Text style={{ color: colors.textSecondary }}>This reset link is invalid, expired, or unavailable. Request a new email and try again.</Text>
        <AuthInlineLink label="Request a new reset email" onPress={() => {
          clearPasswordReset(id);
          router.replace("/(auth)/forgot-password");
        }} />
      </>}
      {(state === "ready" || state === "saving") && <>
        <AuthInput placeholder="New password" value={password} onChangeText={setPassword}
          secureTextEntry autoComplete="new-password" autoCapitalize="none" editable={state === "ready"} />
        <PrimaryAuthButton label={state === "saving" ? "Saving..." : "Reset password"}
          onPress={onReset} disabled={state === "saving"} />
      </>}
      {!!message && <Text style={{ color: colors.textSecondary }}>{message}</Text>}
    </AuthScaffold>
  );
}
