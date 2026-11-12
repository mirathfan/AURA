import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { DeletionProvider, useAccountDeletion } from "./DeletionProvider";
let mockUser = { uid: "one" };
const mockCallbacks: any[] = [];
jest.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../lib/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), onSnapshot: (_ref: unknown, _opts: unknown, next: any) => { mockCallbacks.push(next); return jest.fn(); } }));
it("uses server state, restores deletion on relaunch, and ignores previous-account callbacks", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <DeletionProvider>{children}</DeletionProvider>;
  const { result, rerender } = renderHook(useAccountDeletion, { wrapper });
  const emit = (index: number, cached = false) => mockCallbacks[index]({ exists: () => true, data: () => ({ state: "retry" }), metadata: { fromCache: cached } });
  act(() => emit(0, true)); expect(result.current.status).toBeNull();
  act(() => emit(0)); expect(result.current.status?.state).toBe("retry");
  mockUser = { uid: "two" }; rerender({}); expect(result.current.status).toBeNull();
  act(() => emit(0)); expect(result.current.status).toBeNull();
});
