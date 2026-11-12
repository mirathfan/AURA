import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell } from "@/components/PolicyShell";
import { supportEmailHref, supportEmailLabel } from "@/lib/site";

export const metadata: Metadata = {
  title: "Delete Your AURA Account",
  description: "How to delete an AURA account and its user-scoped data.",
};

export default function DeleteAccountPage() {
  return (
    <PolicyShell
      eyebrow="Account / Privacy"
      title="Delete your AURA account"
      intro="A signed-in user can permanently delete their account from inside the AURA app."
    >
      <h2>Delete from the app</h2>
      <ol>
        <li>Open AURA and sign in to the account you want to delete.</li>
        <li>Open the <strong>Profile</strong> tab.</li>
        <li>Select <strong>Account</strong>.</li>
        <li>Scroll to <strong>Danger Zone</strong> and select <strong>Delete account</strong>.</li>
        <li>Review the deletion screen, verify your identity if requested, and choose <strong>Delete account</strong> on the final confirmation.</li>
      </ol>
      <p>After your request is accepted, AURA locks the account against new app data and shows deletion status. Cleanup continues on the server if you close the app, with automatic retries after interruptions. Once completion is confirmed, choose Return to Welcome to clear user-scoped local app data and sign out.</p>

      <h2>Data covered by the deletion</h2>
      <p>The account-deletion backend removes the Firebase Authentication user, the user&apos;s Firestore document and nested subcollections, files stored under the user&apos;s Firebase Storage path, and known function rate-limit records linked to the account. This includes user-scoped closet items and images, AURA chats, saved looks, outfit plans, preferences, and related metadata stored beneath the account.</p>

      <h2>Sign in with Apple</h2>
      <p>Apple-linked accounts are asked for fresh Apple authorization so AURA can revoke the grant. If this fails or is cancelled, you can explicitly continue deleting your AURA data and manually remove AURA under Settings → your name → Sign in with Apple, or at account.apple.com. Deleting a Firebase account alone does not revoke Apple authorization.</p>

      <h2>Practical retention limits</h2>
      <p>Cleanup normally waits at least ten minutes for earlier activity to finish; outages and large accounts may take longer. A minimal deletion-status record containing the account ID remains to block delayed writes. Operational and processor logs, backups, Storage recovery/version history, and legacy shared search caches follow separate retention policies. Website beta-waitlist entries in Google Sheets require a separate request to support. Exact retention settings remain a release-verification gate.</p>

      <h2>If you cannot access AURA</h2>
      <p>Contact {supportEmailHref ? <a href={supportEmailHref}>{supportEmailLabel}</a> : <strong>{supportEmailLabel}</strong>} from the email associated with your beta account. Do not send your password or authentication tokens.</p>
      <p>For more information, read the <Link href="/privacy">Privacy Policy</Link>.</p>
    </PolicyShell>
  );
}
