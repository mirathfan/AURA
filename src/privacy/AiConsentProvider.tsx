import { useAccountDeletion } from "../account/DeletionProvider";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { auth, db } from "../lib/firebase";
import { useAppTheme } from "../hooks/useAppTheme";
import { AI_CONSENT_VERSION, isCurrentAiConsent, type AiConsentRecord, type AiConsentStatus } from "../../shared/aiConsent";
import { AURA_PUBLIC_DETAILS, AI_CONSENT_DISCLOSURE, PRIVACY_SECTIONS, PRIVACY_UPDATED } from "../../shared/privacyPolicy";
import { allowAiLocally, blockAiLocally, isAiLocallyBlocked, saveAiConsent } from "./consentClient";

type State = { uid: string; record: AiConsentRecord | null; confirmed: boolean; error: string | null };
const ConsentContext = createContext<{
  approved: boolean; record: AiConsentRecord | null; confirmed: boolean;
  review: () => void;
} | null>(null);

export function useAiConsent() {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("AiConsentProvider is required");
  return value;
}

export function PrivacyPolicyText() {
  const { colors } = useAppTheme();
  return <View style={{ gap: 16 }}>
    <Text style={{ color: colors.textSecondary }}>Updated {PRIVACY_UPDATED}</Text>
    {PRIVACY_SECTIONS.map((section) => <View key={section.title} style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700" }}>{section.title}</Text>
      <Text selectable style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 23 }}>{section.text}</Text>
    </View>)}
    {[
      ["Public Privacy Policy", AURA_PUBLIC_DETAILS.privacyUrl],
      ["Terms", AURA_PUBLIC_DETAILS.termsUrl],
      [`Email ${AURA_PUBLIC_DETAILS.supportEmail}`, `mailto:${AURA_PUBLIC_DETAILS.supportEmail}`],
    ].map(([label, url]) => <Pressable key={url} accessibilityRole="link" onPress={() => {
      void Linking.openURL(url).catch(() => Alert.alert("Link unavailable", "The Privacy Policy is still readable here. You can contact " + AURA_PUBLIC_DETAILS.supportEmail + " from your email app."));
    }} style={{ paddingVertical: 10 }}><Text style={{ color: colors.textPrimary }}>{label}</Text></Pressable>)}
  </View>;
}

export function AiConsentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { colors } = useAppTheme();
  const [state, setState] = useState<State>({ uid: "", record: null, confirmed: false, error: null });
  const [dismissedUid, setDismissedUid] = useState<string | null>(null);
  const [reviewUid, setReviewUid] = useState<string | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locallyDeniedUid, setLocallyDeniedUid] = useState<string | null>(null);
  const saving = useRef(false);
  const current = state.uid === uid ? state : null;
  const record = current?.record ?? null;
  const approved = !!uid && locallyDeniedUid !== uid && !isAiLocallyBlocked(uid) && !!current?.confirmed && isCurrentAiConsent(record);
  const needsChoice = !!current?.confirmed && (!record || record.policyVersion !== AI_CONSENT_VERSION);
  const deletion = useAccountDeletion();
  const visible = !deletion.status && !!uid && (reviewUid === uid || (dismissedUid !== uid && needsChoice));

  useEffect(() => { setDismissedUid(null); setReviewUid(null); }, [uid]);

  useEffect(() => {
    let live = true;
    setMessage(""); setShowPolicy(false);
    setState({ uid, record: null, confirmed: false, error: null });
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", uid, "privacy", "aiConsent"), { includeMetadataChanges: true }, (snapshot) => {
      if (live) setState({ uid, record: snapshot.exists() ? snapshot.data() as AiConsentRecord : null,
        confirmed: !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites, error: null });
    }, (error) => { if (live) setState({ uid, record: null, confirmed: false, error: error.code }); });
    return () => { live = false; unsubscribe(); };
  }, [uid, retryCount]);

  async function choose(status: AiConsentStatus) {
    if (saving.current || !uid) return;
    const owner = uid;
    saving.current = true; setBusy(true); setMessage("");
    // Local denial is immediate; the UI only claims server revocation on success.
    if (status !== "accepted") { blockAiLocally(owner); setLocallyDeniedUid(owner); }
    try {
      await saveAiConsent(status, record?.revision ?? 0);
      if (auth.currentUser?.uid !== owner) return;
      if (status === "accepted") { allowAiLocally(owner); setLocallyDeniedUid(null); }
      setDismissedUid(owner); setReviewUid(null);
    } catch {
      if (auth.currentUser?.uid !== owner) return;
      setMessage(status === "revoked"
        ? "Revocation is not confirmed by the server. AI is off on this screen; reconnect and retry to stop other devices and jobs."
        : "Your choice could not be saved. AI stays off. Check your connection and try again.");
    } finally {
      saving.current = false; setBusy(false);
    }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable
    accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={action} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 14, padding: 16, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: colors.textPrimary, fontWeight: "700", textAlign: "center" }}>{label}</Text>
  </Pressable>;

  return <ConsentContext.Provider value={{ approved, record, confirmed: !!current?.confirmed, review: () => { setMessage(""); setShowPolicy(false); setReviewUid(uid); } }}>
    {children}
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!busy) { setDismissedUid(uid); setReviewUid(null); } }}>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 44, gap: 18, backgroundColor: colors.background }}>
        <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "700" }}>{showPolicy ? "Privacy Policy" : "Your choice about AI"}</Text>
        {showPolicy ? <><PrivacyPolicyText />{button("Back to your choice", () => setShowPolicy(false))}</> : <>
          {AI_CONSENT_DISCLOSURE.map((paragraph) => <Text key={paragraph} style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24 }}>{paragraph}</Text>)}
          <Text style={{ color: colors.textSecondary }}>Policy version {AI_CONSENT_VERSION}. {approved ? "AI sharing is on." : "AI sharing is off or not yet confirmed."}</Text>
          {button("Privacy Policy", () => setShowPolicy(true))}
          {!!message && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{message}</Text>}
          {current?.error && <>
            <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{current.error === "permission-denied"
              ? "The server denied access to your privacy settings. AI stays off. Please contact support if retrying does not help."
              : "Privacy settings could not be loaded. Check your connection and retry. AI stays off."}</Text>
            {button("Retry privacy settings", () => setRetryCount((count) => count + 1), busy)}
          </>}
          {approved ? button("Revoke AI consent", () => void choose("revoked"), busy)
            : button(busy ? "Saving…" : "Accept AI sharing", () => void choose("accepted"), busy || !current?.confirmed)}
          {!approved && isCurrentAiConsent(record) && button("Retry revocation", () => void choose("revoked"), busy)}
          {!approved && button("Not Now", () => void choose("declined"), busy)}
          {(approved || !!message || !current?.confirmed) && button("Close", () => { setDismissedUid(uid); setReviewUid(null); }, busy)}
        </>}
      </ScrollView>
    </Modal>
  </ConsentContext.Provider>;
}

export function AiConsentGate({ children }: { children: React.ReactNode }) {
  const { approved, review } = useAiConsent();
  const { colors } = useAppTheme();
  if (approved) return <>{children}</>;
  return <View style={{ flex: 1, justifyContent: "center", padding: 28, gap: 18, backgroundColor: colors.background }}>
    <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>AI sharing is off</Text>
    <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24 }}>Review how AURA uses OpenAI before using this feature. Your closet and saved outfits are still available.</Text>
    <Pressable accessibilityRole="button" onPress={review} style={{ paddingVertical: 16 }}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>Review Privacy & AI</Text></Pressable>
  </View>;
}
