import { useAccountDeletion } from "../account/DeletionProvider";
import { router, useRootNavigationState, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getCachedProfilePreferences } from "../lib/localCache";
import { loadUserProfilePreferences } from "../lib/userProfile";

type ProfileState = "idle" | "loading" | "onboarded" | "needs_onboarding" | "error";
type RouteState = { index?: number; routes?: readonly { name: string; state?: RouteState }[] };

function activeRouteSegments(state: RouteState | undefined): string[] {
  if (!state?.routes?.length) return [];
  const route = state.routes[state.index ?? state.routes.length - 1];
  const own = route.name === "__root" ? [] : route.name.split("/");
  return [...own, ...activeRouteSegments(route.state)];
}

export function useAuthRouting() {
  const { user, loading, profileRevision } = useAuth();
  const deletion = useAccountDeletion();
  const hydratedSegments: readonly string[] = useSegments();
  const navigation = useRootNavigationState();
  // Router 6's useSegments cache waits for ALL nested navigators to hydrate.
  // Read the pending destination from root state while screen content is gated.
  const pendingSegments = activeRouteSegments(navigation);
  const segments = pendingSegments.length ? pendingSegments : hydratedSegments;
  const [profile, setProfile] = useState({ uid: "", revision: -1, state: "loading" as ProfileState });
  // Never apply a previous account's/profile revision's onboarding decision.
  const profileState: ProfileState = !user ? "idle"
    : profile.uid === user.uid && profile.revision === profileRevision ? profile.state : "loading";
  const publicRoute = segments[0] === "privacy";
  const recoveryRoute = segments[0] === "account-deletion" || !!deletion.status || segments[0] === "(auth)" &&
    (segments[1] === "forgot-password" || segments[1] === "reset-password");

  useEffect(() => {
    if (loading || !user?.uid) {
      setProfile({ uid: "", revision: -1, state: "loading" });
      return;
    }
    let cancelled = false;
    const uid = user.uid;
    const update = (state: ProfileState) => {
      if (!cancelled) setProfile({ uid, revision: profileRevision, state });
    };
    update("loading");
    void (async () => {
      const cached = await getCachedProfilePreferences(uid).catch(() => null);
      const cachedOnboarded = Boolean(cached?.data?.onboardingCompleted);
      if (cachedOnboarded) update("onboarded");
      try {
        const preferences = await loadUserProfilePreferences(uid);
        update(preferences.onboardingCompleted ? "onboarded" : "needs_onboarding");
      } catch {
        update(cachedOnboarded ? "onboarded" : "error");
      }
    })();
    return () => { cancelled = true; };
  }, [loading, profileRevision, user?.uid]);

  const ready = !!navigation?.key && segments.length > 0;
  const waiting = !publicRoute && (loading || !ready || (!recoveryRoute && !!user && profileState === "loading"));
  const profileError = !publicRoute && !loading && !recoveryRoute && !!user && profileState === "error";
  let redirect: "/(auth)/welcome" | "/(onboarding)" | "/(tabs)" | null = null;
  if (!waiting && !profileError && !recoveryRoute && !publicRoute) {
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";
    if (!user && !inAuth) redirect = "/(auth)/welcome";
    else if (user && profileState === "needs_onboarding" && !inOnboarding) redirect = "/(onboarding)";
    else if (user && profileState === "onboarded" && (inAuth || inOnboarding)) redirect = "/(tabs)";
  }
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect]);

  return { profileState, waiting: waiting || !!redirect, profileError, publicRoute };
}
