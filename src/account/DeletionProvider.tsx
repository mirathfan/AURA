import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import type { DeletionStatus } from "../../shared/accountDeletion";

type State = { uid: string; status: DeletionStatus | null; confirmed: boolean; error: boolean };
const empty: State = { uid: "", status: null, confirmed: false, error: false };
const Context = createContext<State>(empty);
export function DeletionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [state, setState] = useState(empty);
  useEffect(() => {
    let live = true;
    setState({ ...empty, uid });
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, "accountDeletionJobs", uid), { includeMetadataChanges: true }, (snapshot) => {
      if (!live || snapshot.metadata.fromCache) return;
      setState({ uid, status: snapshot.exists() ? snapshot.data() as DeletionStatus : null, confirmed: true, error: false });
    }, () => { if (live) setState((previous) => ({ ...previous, uid, error: true })); });
    return () => { live = false; unsubscribe(); };
  }, [uid]);
  // Never expose the previous account's deletion decision to a new account.
  return <Context.Provider value={state.uid === uid ? state : { ...empty, uid }}>{children}</Context.Provider>;
}
export function useAccountDeletion() { return useContext(Context); }
