import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from "@/lib/privacyPolicy";
import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell } from "@/components/PolicyShell";
import {
  supportEmailHref,
  supportEmailLabel,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — AURA",
  description: "How AURA handles account, wardrobe, AI, and diagnostic data during beta.",
};

export default function PrivacyPage() {
  return (
    <PolicyShell
      eyebrow="Privacy / Beta"
      title="Privacy Policy"
      intro="How AURA handles the information needed to build your digital closet and provide AI styling features."
    >
      <p className="policy-updated">Last updated {PRIVACY_UPDATED}. Prepared for beta; public-page accessibility and email deliverability still require verification.</p>
      {PRIVACY_SECTIONS.map((section) => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.text.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
      <p>For privacy or deletion help: {supportEmailHref ? <a href={supportEmailHref}>{supportEmailLabel}</a> : <strong>{supportEmailLabel}</strong>}. Read the <Link href="/delete-account">account deletion instructions</Link>.</p>
    </PolicyShell>
  );
}
