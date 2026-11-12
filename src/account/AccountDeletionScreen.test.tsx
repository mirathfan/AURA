import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { signOut } from "firebase/auth";
import AccountDeletionScreen from "./AccountDeletionScreen";
import { prepareAppleDeletion, requestAccountDeletion, readAccountDeletionStatus } from "./deletionClient";

jest.mock("expo-apple-authentication", () => ({ addRevokeListener: jest.fn(() => ({ remove: jest.fn() })) }));
let mockUser = { uid: "one", providerData: [{ providerId: "password" }] };
let mockStatus: any = null;
jest.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../lib/firebase", () => ({ auth: { get currentUser() { return mockUser; } } }));
jest.mock("./DeletionProvider", () => ({ useAccountDeletion: () => ({ status: mockStatus }) }));
jest.mock("../hooks/useAppTheme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../lib/storage", () => ({ Storage: { clearUserScopedData: jest.fn(async () => undefined) } }));
jest.mock("../auth/googleAuth", () => ({ signOutGoogle: jest.fn(async () => undefined) }));
jest.mock("firebase/auth", () => ({ signOut: jest.fn(async () => undefined) }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() } }));
jest.mock("./deletionClient", () => ({ prepareAppleDeletion: jest.fn(), requestAccountDeletion: jest.fn(), readAccountDeletionStatus: jest.fn(), reauthenticateForDeletion: jest.fn(), isDeletionCancellation: (e: any) => e.code === "ERR_REQUEST_CANCELED" }));
jest.mock("../components/auth/AuthScaffold", () => {
  const { View, Text, TextInput, Pressable } = jest.requireActual("react-native");
  const button = ({ label, ...props }: any) => <Pressable {...props}><Text>{label}</Text></Pressable>;
  return { AuthScaffold: ({ title, subtitle, children }: any) => <View><Text>{title}</Text><Text>{subtitle}</Text>{children}</View>, AuthInput: (props: any) => <TextInput {...props} />, PrimaryAuthButton: button, SecondaryAuthButton: button };
});
let confirm: () => void;
beforeEach(() => {
  mockUser = { uid: "one", providerData: [{ providerId: "password" }] }; mockStatus = null;
  jest.mocked(prepareAppleDeletion).mockResolvedValue("not_linked");
  jest.mocked(requestAccountDeletion).mockResolvedValue({ state: "retry", stage: "firestore", apple: "not_linked" });
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => { confirm = buttons![1].onPress! as () => void; });
});
afterEach(() => jest.restoreAllMocks());
it("requires final confirmation and coalesces double taps without claiming success", async () => {
  let finish!: (value: any) => void;
  jest.mocked(requestAccountDeletion).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = render(<AccountDeletionScreen />);
  fireEvent.press(view.getByText("Continue to deletion")); expect(requestAccountDeletion).not.toHaveBeenCalled();
  await act(async () => { confirm(); confirm(); });
  expect(requestAccountDeletion).toHaveBeenCalledTimes(1); expect(view.queryByText("Account deleted")).toBeNull();
  await act(async () => finish({ state: "retry", stage: "storage", apple: "not_linked" }));
  expect(view.getByText(/Cleanup was interrupted/)).toBeTruthy(); expect(signOut).not.toHaveBeenCalled();
});
it("offers identity verification for stale auth", async () => {
  jest.mocked(requestAccountDeletion).mockRejectedValueOnce({ details: { code: "REQUIRES_RECENT_LOGIN" } });
  const view = render(<AccountDeletionScreen />); fireEvent.press(view.getByText("Continue to deletion")); await act(async () => confirm());
  expect(view.getByText("Verify identity")).toBeTruthy(); expect(view.getByPlaceholderText("Password")).toBeTruthy();
});
it("Apple cancellation does not delete and exposes an explicit manual fallback", async () => {
  jest.mocked(prepareAppleDeletion).mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });
  const view = render(<AccountDeletionScreen />); fireEvent.press(view.getByText("Continue to deletion")); await act(async () => confirm());
  expect(requestAccountDeletion).not.toHaveBeenCalled(); expect(view.getByText("Delete with manual Apple revocation")).toBeTruthy();
  fireEvent.press(view.getByText("Delete with manual Apple revocation")); await act(async () => confirm());
  expect(requestAccountDeletion).toHaveBeenCalledWith(mockUser, true);
});
it("recovers server status after a timeout without inventing completion", async () => {
  jest.mocked(readAccountDeletionStatus).mockResolvedValue({ state: "deleting", stage: "auth", apple: "not_linked" });
  const view = render(<AccountDeletionScreen />); fireEvent.press(view.getByText("Check deletion status"));
  await waitFor(() => expect(view.getByText(/Your deletion request was accepted/)).toBeTruthy()); expect(view.queryByText("Account deleted")).toBeNull();
});
it("completion returns to unauthenticated state only when explicitly confirmed by the server", async () => {
  mockStatus = { state: "completed", stage: "verify", apple: "manual_required" };
  const view = render(<AccountDeletionScreen />); expect(view.getByText("Account deleted")).toBeTruthy();
  fireEvent.press(view.getByText("Return to Welcome")); await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
});
it("clears another account's recovery and Apple fallback state on switching accounts", async () => {
  jest.mocked(prepareAppleDeletion).mockResolvedValueOnce("manual_required");
  const view = render(<AccountDeletionScreen />); fireEvent.press(view.getByText("Continue to deletion")); await act(async () => confirm());
  expect(view.getByText("Delete with manual Apple revocation")).toBeTruthy(); mockUser = { ...mockUser, uid: "two" }; view.rerender(<AccountDeletionScreen />);
  expect(view.queryByText("Delete with manual Apple revocation")).toBeNull();
});
