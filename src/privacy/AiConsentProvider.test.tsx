import React from "react";
import { Alert, Linking, Text, Pressable } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AiConsentProvider, PrivacyPolicyText, useAiConsent } from "./AiConsentProvider";
import { AI_CONSENT_VERSION } from "../../shared/aiConsent";
import { allowAiLocally, saveAiConsent } from "./consentClient";

let mockUser: { uid: string } | null = { uid: "one" };
const mockCallbacks: ((snapshot: unknown) => void)[] = [];
jest.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../lib/firebase", () => ({ db: {}, auth: { get currentUser() { return mockUser; } } }));
jest.mock("../hooks/useAppTheme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), onSnapshot: (_ref: unknown, _options: unknown, callback: (snapshot: unknown) => void) => {
  mockCallbacks.push(callback); return jest.fn();
} }));
jest.mock("./consentClient", () => ({
  ...jest.requireActual("./consentClient"), saveAiConsent: jest.fn(),
}));
jest.mock("firebase/functions", () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));
const accepted = { status: "accepted", policyVersion: AI_CONSENT_VERSION, revision: 1, updatedAt: new Date() };
function emit(record: unknown, cached = false, index = mockCallbacks.length - 1) {
  act(() => mockCallbacks[index]({ exists: () => !!record, data: () => record, metadata: { fromCache: cached, hasPendingWrites: false } }));
}
function Probe() { const { approved, review } = useAiConsent(); return <><Text testID="approved">{String(approved)}</Text><Pressable onPress={review}><Text>Manage</Text></Pressable></>; }
const tree = () => <AiConsentProvider><Probe /></AiConsentProvider>;
beforeEach(() => { mockCallbacks.length = 0; mockUser = { uid: "one" }; allowAiLocally("one"); allowAiLocally("two"); jest.mocked(saveAiConsent).mockResolvedValue({} as never); });

it("keeps the bundled policy readable when the canonical public URL is unavailable", async () => {
  const open = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("offline"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    const view = render(<PrivacyPolicyText />);
    fireEvent.press(view.getByText("Public Privacy Policy"));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith("https://aura-kasatlabs.vercel.app/privacy");
    expect(view.getByText("Retention and deletion")).toBeTruthy();
    expect(view.getByText("Email support@getaura.app")).toBeTruthy();
  } finally { open.mockRestore(); alert.mockRestore(); }
});

it("requires explicit acceptance for new users; Not Now never enables AI", async () => {
  const view = render(tree()); emit(null);
  expect(view.getByTestId("approved").props.children).toBe("false");
  fireEvent.press(view.getByText("Not Now"));
  await waitFor(() => expect(saveAiConsent).toHaveBeenCalledWith("declined", 0));
  emit({ ...accepted, status: "declined" });
  expect(view.getByTestId("approved").props.children).toBe("false");
});

it("waits for server acceptance, ignores cached records and shows the policy", async () => {
  const view = render(tree()); emit(accepted, true);
  expect(view.getByTestId("approved").props.children).toBe("false");
  emit(null); fireEvent.press(view.getByText("Privacy Policy"));
  expect(view.getByText("Retention and deletion")).toBeTruthy();
  fireEvent.press(view.getByText("Back to your choice"));
  fireEvent.press(view.getByText("Accept AI sharing"));
  await waitFor(() => expect(saveAiConsent).toHaveBeenCalledWith("accepted", 0));
  expect(view.getByTestId("approved").props.children).toBe("false");
  emit(accepted);
  expect(view.getByTestId("approved").props.children).toBe("true");
});

it("revocation turns AI off immediately and reports a failed server save honestly", async () => {
  jest.mocked(saveAiConsent).mockRejectedValueOnce(new Error("offline"));
  const view = render(tree()); emit(accepted); fireEvent.press(view.getByText("Manage"));
  fireEvent.press(view.getByText("Revoke AI consent"));
  expect(view.getByTestId("approved").props.children).toBe("false");
  await waitFor(() => expect(view.getByText(/Revocation is not confirmed/)).toBeTruthy());
  expect(view.getByText("Retry revocation")).toBeTruthy();
});

it("does not reuse consent during account switching or from a stale listener", () => {
  const view = render(tree()); emit(accepted);
  mockUser = { uid: "two" }; view.rerender(tree());
  expect(view.getByTestId("approved").props.children).toBe("false");
  emit(accepted, false, 0);
  expect(view.getByTestId("approved").props.children).toBe("false");
  emit({ ...accepted, policyVersion: "old" });
  expect(view.getByText("Accept AI sharing")).toBeTruthy();
  expect(view.getByTestId("approved").props.children).toBe("false");
});
