import { rememberPasswordReset } from "../auth/passwordResetAction";

const LOGIN = "/(auth)/login";
const AUTH_PATHS = new Set(["welcome", "login", "register", "forgot-password"]);
const APP_PATH = /^(?:\(tabs\)\/)?(?:closet|ai|calendar|profile|today|add|laundry|studio|item\/[^/]+)$|^(?:saved-outfits(?:\/[^/]+)?|packing|insights(?:\/(?:unworn|gaps))?|aura\/swipe|profile\/(?:shopping-preferences|units-region|style-preferences|notifications|default-sizes|account|closet-preferences|body-fit|my-looks))$/;

export type LinkConfiguration = { apiKey?: string; authDomain?: string; googleActive?: boolean };

export function normalizeIncomingLink(raw: string, config: LinkConfiguration): string {
  try {
    if (!raw || raw.length > 8192 || /[\s\\\u0000-\u001f]/.test(raw)) return LOGIN;
    const relative = raw.startsWith("/") && !raw.startsWith("//");
    const url = new URL(relative ? `aura://${raw}` : raw);
    if (url.username || url.password || url.port) return LOGIN;

    // ASWebAuthenticationSession/AppAuth consumes legitimate native callbacks.
    // A JS event is not an authorization response and must never exchange tokens.
    if (/^com\.googleusercontent\.apps\.[a-z0-9-]+:$/.test(url.protocol)) {
      return config.googleActive ? "" : LOGIN;
    }
    const appLink = url.protocol === "aura:";
    const firebaseLink = url.protocol === "https:" && !!config.authDomain &&
      url.hostname === config.authDomain.toLowerCase();
    if (!appLink && !firebaseLink) return LOGIN;

    const path = decodeURIComponent(appLink ? `${url.hostname}${url.pathname}` : url.pathname)
      .replace(/^\/+|\/+$/g, "");
    const authPath = path.replace(/^\(auth\)\//, "");
    if (authPath === "oauthredirect") return config.googleActive ? "" : LOGIN;
    if (url.hash) return LOGIN;

    const params = url.searchParams;
    const action = firebaseLink || ["mode", "oobCode", "apiKey"].some((key) => params.has(key));
    if (action) {
      if (!["forgot-password", "reset-password", "__/auth/action"].includes(authPath)) return LOGIN;
      if (["mode", "oobCode", "apiKey"].some((key) => params.getAll(key).length !== 1)) return LOGIN;
      if (params.get("mode") !== "resetPassword" || !config.apiKey || params.get("apiKey") !== config.apiKey) return LOGIN;
      const code = params.get("oobCode") ?? "";
      if (!/^[A-Za-z0-9_-]{1,2048}$/.test(code)) return LOGIN;
      // continueUrl is deliberately not followed; lang is not a security input.
      // Always use this app's Firebase instance, never credentials from a link.
      const id = rememberPasswordReset(code);
      return `/(auth)/reset-password?request=${id}`;
    }
    // App navigation links open the email-request screen, not a reset action.
    // External query/fragment data is never passed through into navigation.
    if (AUTH_PATHS.has(authPath)) return `/(auth)/${authPath}`;
    if (path === "privacy") return "/privacy";
    if (!path || path === "(tabs)") return "/";
    if (path === "(onboarding)") return "/(onboarding)";
    if (APP_PATH.test(path)) return `/${path}`;
    return LOGIN;
  } catch {
    return LOGIN;
  }
}
