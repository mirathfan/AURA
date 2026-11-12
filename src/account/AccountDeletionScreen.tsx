import { holdAppleRevocationSignOut } from "../auth/appleRevocation";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Text } from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { AuthInput, AuthScaffold, PrimaryAuthButton, SecondaryAuthButton } from "../components/auth/AuthScaffold";
import { useAppTheme } from "../hooks/useAppTheme";
import { auth } from "../lib/firebase";
import { Storage } from "../lib/storage";
import { signOutGoogle } from "../auth/googleAuth";
import { useAuth } from "../contexts/AuthContext";
import { useAccountDeletion } from "./DeletionProvider";
import { isDeletionCancellation, prepareAppleDeletion, reauthenticateForDeletion, requestAccountDeletion, readAccountDeletionStatus } from "./deletionClient";
import { APPLE_MANUAL_REVOCATION, deletionStatusMessage, type DeletionStatus } from "../../shared/accountDeletion";
import { AURA_PUBLIC_DETAILS } from "../../shared/privacyPolicy";

export default function AccountDeletionScreen() {
  const { user } = useAuth();
  const { status: serverStatus } = useAccountDeletion();
  const { colors } = useAppTheme();
  const [local, setLocal] = useState<{ uid: string; status: DeletionStatus } | null>(null);
  const status = serverStatus ?? (local?.uid === user?.uid ? local?.status : null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [reauth, setReauth] = useState(false);
  const [fallback, setFallback] = useState(false);
  const owner = user?.uid;
  useEffect(() => { setLocal(null); setPassword(""); setFallback(false); setReauth(false); setMessage(""); }, [owner]);
  useEffect(() => owner ? holdAppleRevocationSignOut(owner) : undefined, [owner]);
  const hasPassword = user?.providerData.some((provider) => provider.providerId === "password");
  async function run(operation: () => Promise<void>) {
    if (locked.current || !user) return;
    locked.current = true; setBusy(true); setMessage("");
    try { await operation(); } catch (error) {
      if (auth.currentUser?.uid !== owner) return;
      if (isDeletionCancellation(error)) {
        setMessage("Apple sign-in was cancelled. No deletion request was sent. You can cancel deletion or continue with manual Apple revocation.");
        setFallback(true);
      } else if ((error as { details?: { code?: string } })?.details?.code === "REQUIRES_RECENT_LOGIN") {
        setReauth(true); setMessage("Please verify your identity again, then confirm deletion.");
      } else if ((error as { details?: { code?: string } })?.details?.code === "APPLE_REVOCATION_REQUIRED") {
        setFallback(true); setMessage(APPLE_MANUAL_REVOCATION);
      } else {
        setMessage("Deletion is not confirmed. Check status before trying again. If a request was accepted, cleanup continues automatically. For help, contact " + AURA_PUBLIC_DETAILS.supportEmail + ".");
      }
    } finally { locked.current = false; setBusy(false); setPassword(""); }
  }
  async function submit(allowFallback: boolean) {
    if (!user) return;
    if (!allowFallback && !status) {
      const apple = await prepareAppleDeletion(user);
      if (apple === "manual_required") { setFallback(true); setMessage(APPLE_MANUAL_REVOCATION); return; }
    }
    const next = await requestAccountDeletion(user, allowFallback);
    if (auth.currentUser?.uid === user.uid) setLocal({ uid: user.uid, status: next });
  }
  function confirm(allowFallback = false) {
    Alert.alert("Permanently delete account?", "This removes your AURA account and data. Once accepted, deletion cannot be cancelled.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => { void run(() => submit(allowFallback)); } },
    ]);
  }
  return <AuthScaffold eyebrow="ACCOUNT" title={status?.state === "completed" ? "Account deleted" : "Delete account"}
    subtitle={deletionStatusMessage(status ?? null)}>
    {message ? <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{message}</Text> : null}
    {(fallback || status?.apple === "manual_required") && <Text style={{ color: colors.textSecondary }}>{APPLE_MANUAL_REVOCATION}</Text>}
    {!user ? <Text style={{ color: colors.textSecondary }}>Sign in to check account status. Previously accepted requests continue on the server. Contact {AURA_PUBLIC_DETAILS.supportEmail} if you cannot sign in.</Text> : null}
    {reauth && !status && <>
      {hasPassword && <AuthInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />}
      <PrimaryAuthButton label="Verify identity" disabled={busy} onPress={() => { void run(async () => {
        if (!user) return;
        await reauthenticateForDeletion(user, password); setReauth(false); setMessage("Identity verified. Confirm deletion to continue.");
      }); }} />
      <SecondaryAuthButton label="Sign out and sign in again" onPress={() => { if (!busy) void signOut(auth).then(() => router.replace("/(auth)/login")); }} />
    </>}
    {status?.state === "completed" ? <PrimaryAuthButton label="Return to Welcome" disabled={busy} onPress={() => { void run(async () => {
      if (!user) return;
      await Storage.clearUserScopedData(user.uid);
      await signOutGoogle();
      if (auth.currentUser?.uid !== user.uid) return;
      await signOut(auth); router.replace("/(auth)/welcome");
    }); }} /> : <>
      <PrimaryAuthButton label={busy ? "Checking deletion…" : status ? "Retry cleanup" : fallback ? "Delete with manual Apple revocation" : "Continue to deletion"}
        disabled={busy || !user || reauth} onPress={() => { if (status) void run(() => submit(true)); else confirm(fallback); }} />
      <SecondaryAuthButton label="Check deletion status" onPress={() => { void run(async () => {
        if (!user) return;
        const next = await readAccountDeletionStatus(user);
        if (next) setLocal({ uid: user.uid, status: next });
        else setMessage("No deletion request has been accepted for this account.");
      }); }} />
      {!status && <SecondaryAuthButton label="Cancel" onPress={() => { if (!busy) router.back(); }} />}
    </>}
    <SecondaryAuthButton label="Privacy Policy" onPress={() => router.push("/privacy" as never)} />
    <SecondaryAuthButton label={`Help: ${AURA_PUBLIC_DETAILS.supportEmail}`} onPress={() => { void Linking.openURL(`mailto:${AURA_PUBLIC_DETAILS.supportEmail}`).catch(() => setMessage("Email " + AURA_PUBLIC_DETAILS.supportEmail + " from your email app.")); }} />
  </AuthScaffold>;
}
