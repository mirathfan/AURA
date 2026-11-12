import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import ResetPasswordScreen from "../../app/(auth)/reset-password";
import { rememberPasswordReset, clearPasswordReset, getPasswordResetCode } from "./passwordResetAction";

let mockRequest: string | undefined;
jest.mock("expo-router", () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({ request: mockRequest }) }));
jest.mock("firebase/auth", () => ({ confirmPasswordReset: jest.fn(), verifyPasswordResetCode: jest.fn() }));
jest.mock("../lib/firebase", () => ({ auth: {} }));
jest.mock("../hooks/useAppTheme", () => ({ useAppTheme: () => ({ colors: { textSecondary: "white" } }) }));
jest.mock("../components/auth/AuthScaffold", () => {
  const React = jest.requireActual("react");
  const { View, Text, TextInput, Pressable } = jest.requireActual("react-native");
  return {
    AuthScaffold: ({ children, footer, subtitle }: any) => <View><Text>{subtitle}</Text>{children}{footer}</View>,
    AuthInput: (props: any) => <TextInput {...props} />,
    PrimaryAuthButton: ({ label, ...props }: any) => <Pressable {...props}><Text>{label}</Text></Pressable>,
    AuthInlineLink: ({ label, ...props }: any) => <Pressable {...props}><Text>{label}</Text></Pressable>,
  };
});
beforeEach(() => {
  clearPasswordReset();
  mockRequest = rememberPasswordReset("private-code");
  jest.mocked(verifyPasswordResetCode).mockResolvedValue("private-email@example.com");
  jest.mocked(confirmPasswordReset).mockResolvedValue();
});
it("validates the retained action with Firebase before enabling confirmation", async () => {
  const ui = render(<ResetPasswordScreen />);
  await waitFor(() => expect(ui.getByPlaceholderText("New password")).toBeTruthy());
  expect(verifyPasswordResetCode).toHaveBeenCalledWith({}, "private-code");
  expect(JSON.stringify(ui.toJSON())).not.toMatch(/private-code|private-email/);
  fireEvent.changeText(ui.getByPlaceholderText("New password"), "new-password");
  fireEvent.press(ui.getByText("Reset password"));
  await waitFor(() => expect(ui.getByText("Your password has been updated.")).toBeTruthy());
  expect(confirmPasswordReset).toHaveBeenCalledWith({}, "private-code", "new-password");
  expect(getPasswordResetCode(mockRequest)).toBeNull();
});
it.each(["auth/expired-action-code", "auth/invalid-action-code", "auth/network-request-failed"])("verification failure %s disables confirmation without displaying provider details", async (code) => {
  jest.mocked(verifyPasswordResetCode).mockRejectedValue({ code, message: "private-code" });
  const ui = render(<ResetPasswordScreen />);
  await waitFor(() => expect(ui.getByText(/This reset link is invalid/)).toBeTruthy());
  expect(ui.queryByPlaceholderText("New password")).toBeNull();
  expect(JSON.stringify(ui.toJSON())).not.toContain("private-code");
  expect(confirmPasswordReset).not.toHaveBeenCalled();
});
it("rejects a fabricated navigation request without calling Firebase", () => {
  mockRequest = "not-retained";
  const ui = render(<ResetPasswordScreen />);
  expect(ui.getByText(/This reset link is invalid/)).toBeTruthy();
  expect(verifyPasswordResetCode).not.toHaveBeenCalled();
});
it("invalidates the UI if Firebase expires a code between validation and confirmation", async () => {
  jest.mocked(confirmPasswordReset).mockRejectedValue({ code: "auth/expired-action-code" });
  const ui = render(<ResetPasswordScreen />);
  await waitFor(() => expect(ui.getByPlaceholderText("New password")).toBeTruthy());
  fireEvent.changeText(ui.getByPlaceholderText("New password"), "new-password");
  fireEvent.press(ui.getByText("Reset password"));
  await waitFor(() => expect(ui.getByText(/This reset link is invalid/)).toBeTruthy());
  expect(getPasswordResetCode(mockRequest)).toBeNull();
});
it("ignores a stale verification result when a second warm action arrives", async () => {
  let first!: (email: string) => void;
  jest.mocked(verifyPasswordResetCode).mockImplementationOnce(() => new Promise((resolve) => { first = resolve; }));
  const ui = render(<ResetPasswordScreen />);
  jest.mocked(verifyPasswordResetCode).mockRejectedValueOnce({ code: "auth/expired-action-code" });
  mockRequest = rememberPasswordReset("second-code");
  ui.rerender(<ResetPasswordScreen />);
  await waitFor(() => expect(ui.getByText(/This reset link is invalid/)).toBeTruthy());
  await act(async () => first("old@example.com"));
  expect(ui.queryByPlaceholderText("New password")).toBeNull();
});
