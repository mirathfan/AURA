import { act, render, waitFor } from "@testing-library/react-native";
import { onAuthStateChanged } from "firebase/auth";
import React from "react";

import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock("../lib/firebase", () => ({
  auth: {},
  hasFirebaseServices: jest.fn(() => true),
}));

const mockOnAuthStateChanged = onAuthStateChanged as jest.Mock;

describe("AuthProvider profile refresh", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset();
    mockOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
  });

  it("publishes a new profile revision when the shared profile is invalidated", async () => {
    const authState = { current: null as ReturnType<typeof useAuth> | null };

    function Consumer() {
      authState.current = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(authState.current?.loading).toBe(false));
    expect(authState.current?.profileRevision).toBe(0);

    act(() => {
      authState.current?.refreshProfile();
    });

    expect(authState.current?.profileRevision).toBe(1);
  });
});
