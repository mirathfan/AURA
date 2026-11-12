"use client";

import Image from "next/image";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AuraReel } from "./AuraReel";
import { BrandLogo } from "./BrandLogo";

const featureStories = [
  {
    number: "01",
    title: "A closet that understands what you own.",
    labels: ["Smart Closet", "Photo Cleanup"],
    images: [
      ["smart-closet-tile.webp", "AURA smart closet with clean clothing images"],
    ],
  },
  {
    number: "02",
    title: "Styling that starts with your real clothes.",
    labels: ["AURA AI Stylist", "Outfit Cards"],
    images: [
      ["ai-stylist-chat-tile.webp", "AURA styling chat with a closet-based outfit"],
    ],
  },
  {
    number: "03",
    title: "From a product find to a planned day.",
    labels: ["Product Link Import", "Calendar Planning"],
    images: [
      ["product-import-screen-public.webp", "AURA product import review"],
      ["calendar-screen-public.webp", "AURA style calendar"],
    ],
  },
] as const;

const faqs = [
  ["What is AURA?", "AURA is an AI personal stylist that helps you build a digital closet, generate outfits, plan looks, and get styling advice from clothes you already own."],
  ["Is AURA free?", "AURA is currently in Early Access Beta. Some AI features may be limited while we test quality and cost."],
  ["Does AURA use my real clothes?", "Yes. AURA is designed to style you from your actual closet, not random generic items."],
  ["Can AURA make mistakes?", "Yes. AURA can make mistakes with styling, item details, colors, or recommendations. Beta feedback helps improve it."],
  ["Is my closet public?", "No. AURA is not a public social closet. Your wardrobe is designed to stay private."],
  ["How do I join?", "Request Early Access through the website. We’ll invite testers gradually."],
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, className = "", delay = 0, id }: { children: React.ReactNode; className?: string; delay?: number; id?: string }) {
  return (
    <motion.div
      className={className}
      id={id}
      initial={false}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function AuraLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState("");
  const [formState, setFormState] = useState<"idle" | "success" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroMediaY = useTransform(heroProgress, [0, 1], [0, reduceMotion ? 0 : 74]);
  const heroMediaScale = useTransform(heroProgress, [0, 1], [1, reduceMotion ? 1 : 0.94]);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.body.classList.add("menu-open");
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSubmitting(true);
    setFormStatus("");
    setFormState("idle");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: String(data.get("name") || "").trim(),
          email: String(data.get("email") || "").trim(),
          company: String(data.get("company") || ""),
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error || "Unable to save your request.");

      form.reset();
      setFormStatus("You’re on the beta list. We’ll be in touch.");
      setFormState("success");
    } catch (error) {
      setFormStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? "The request timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to save your request.",
      );
      setFormState("error");
    } finally {
      window.clearTimeout(timeout);
      setIsSubmitting(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.55, ease }}>
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />
      <a className="skip-link" href="#main">Skip to content</a>

      <motion.header
        className={`site-header ${menuOpen ? "menu-open" : ""}`}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
      >
        <nav className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="AURA home" onClick={() => setMenuOpen(false)}><BrandLogo priority /></a>
          <div className="nav-links" id="nav-links">
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a className="nav-mobile-cta" href="#beta" onClick={() => setMenuOpen(false)}>
              Request Early Access <ArrowIcon />
            </a>
          </div>
          <motion.a className="nav-cta" href="#beta" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            Join Beta <ArrowIcon />
          </motion.a>
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="nav-links"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </nav>
      </motion.header>

      <main id="main">
        <section ref={heroRef} className="hero section-shell" id="top" aria-labelledby="hero-title">
          <motion.div
            className="hero-copy"
            initial={false}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.09, delayChildren: 0.12 } },
            }}
          >
            <motion.p className="hero-kicker" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
              AURA / Early Access Beta
            </motion.p>
            <motion.h1 id="hero-title" variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease } } }}>
              Dress better from what you own.
            </motion.h1>
            <motion.p className="hero-subtitle" variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}>
              A private AI stylist that organizes your wardrobe, builds outfits, and plans what to wear.
            </motion.p>
            <motion.div className="hero-actions" variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}>
              <motion.a className="button button-primary" href="#beta" whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                Request Early Access <ArrowIcon />
              </motion.a>
              <motion.a className="button button-secondary" href="#how-it-works" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                <PlayIcon /> See how it works
              </motion.a>
            </motion.div>
            <motion.p className="beta-note" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
              iOS first · Limited tester spots · AI suggestions improve during beta
            </motion.p>
          </motion.div>

          <motion.div className="hero-media" style={{ y: heroMediaY, scale: heroMediaScale }}>
            <motion.div
              className="hero-product-stage"
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18, duration: 0.9, ease }}
            >
              <Image
                src="/assets/hero-product-visual.webp"
                alt="AURA wardrobe, styling chat, and today’s look screens"
                width={1600}
                height={1000}
                priority
              />
            </motion.div>
          </motion.div>
        </section>

        <section className="signal-strip" aria-label="AURA positioning">
          <div className="signal-track">
            <span>Real wardrobe</span><i />
            <span>Private context</span><i />
            <span>Daily intelligence</span>
          </div>
        </section>

        <section className="section-shell section-block" aria-labelledby="how-title">
          <Reveal className="section-heading split-heading" id="how-it-works">
            <p className="section-index">01 / The flow</p>
            <h2 id="how-title">From closet photo to considered look.</h2>
          </Reveal>
          <div className="steps-grid">
            {[
              ["01", "Add your clothes", "Upload photos, paste product links, or save pieces from outfit photos.", "smart-closet-tile.webp", "AURA closet grid showing clean clothing items"],
              ["02", "Ask AURA", "Get looks and guidance grounded in the clothes you own.", "ai-stylist-chat-tile.webp", "AURA chat with an outfit recommendation"],
              ["03", "Wear and plan", "Save the look today or carry it into your calendar.", "outfit-card-tile.webp", "AURA outfit card with a closet-based look"],
            ].map(([number, title, copy, image, alt], index) => (
              <Reveal key={number} delay={index * 0.08}>
                <motion.article className="step-card" whileHover={{ y: -8 }}>
                  <div className="step-image">
                    <Image src={`/assets/${image}`} alt={alt} width={980} height={680} />
                  </div>
                  <div className="step-copy">
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </motion.article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section-shell section-block features-section" aria-labelledby="features-title">
          <Reveal className="section-heading split-heading" id="features">
            <p className="section-index">02 / The system</p>
            <h2 id="features-title">See what AURA does with your closet.</h2>
            <p>Real wardrobe context, carried from first upload to the day you wear the look.</p>
          </Reveal>
          <div className="feature-story-grid">
            {featureStories.map(({ number, title, labels, images }, index) => (
              <Reveal key={number} className={`feature-story-wrap feature-story-wrap-${index + 1}`} delay={index * 0.07}>
                <motion.figure className={`feature-story ${images.length > 1 ? "feature-story-duo" : ""}`} whileHover={{ y: -6 }}>
                  <div className="feature-story-media">
                    {images.map(([src, alt]) => (
                      <Image key={src} src={`/assets/${src}`} alt={alt} width={980} height={680} />
                    ))}
                  </div>
                  <figcaption>
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <div>{labels.map((label) => <small key={label}>{label}</small>)}</div>
                  </figcaption>
                </motion.figure>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="showcase" aria-labelledby="showcase-title">
          <div className="section-shell">
            <Reveal className="section-heading showcase-heading">
              <p className="section-index">03 / One connected product</p>
              <h2 id="showcase-title">From first upload to tomorrow’s outfit.</h2>
            </Reveal>
            <Reveal className="showcase-reel" delay={0.08}><AuraReel /></Reveal>
          </div>
        </section>

        <section className="section-shell section-block privacy-section" aria-labelledby="privacy-title">
          <Reveal className="privacy-copy" id="privacy">
            <p className="section-index">04 / Privacy</p>
            <h2 id="privacy-title">Built for your wardrobe, not a public feed.</h2>
            <p>Your clothes, outfits, and styling chats stay personal. AURA is built around private wardrobe intelligence.</p>
            <p className="small-note">During beta, photos, links, and chat messages may be processed to provide styling features. See the Privacy Policy for details.</p>
          </Reveal>
          <Reveal className="privacy-panel" delay={0.08}>
            <div className="privacy-panel-head">
              <div className="privacy-status">
                <span className="privacy-status-dot" aria-hidden="true" />
                Private by design
              </div>
              <span className="privacy-not-social">Not a social feed</span>
              <h3>Your wardrobe data works for your style, not an audience.</h3>
              <p>No public profiles, follower counts, likes, or discovery feed.</p>
            </div>
            <div className="privacy-points">
              {[
                ["01", "Private wardrobe", "Your closet is not a public profile."],
                ["02", "Useful context", "Your preferences make styling relevant."],
                ["03", "Your control", "Choose what you add, save, and delete."],
                ["04", "Account deletion", "Delete your account and wardrobe data."],
              ].map(([number, title, copy]) => (
                <motion.article key={number} whileHover={{ x: 5 }}><span>{number}</span><h3>{title}</h3><p>{copy}</p></motion.article>
              ))}
            </div>
            <div className="privacy-panel-footer">
              <span aria-hidden="true" />
              You decide what enters your closet and what leaves it.
            </div>
          </Reveal>
        </section>

        <section className="beta-section section-shell" aria-labelledby="beta-title">
          <Reveal className="beta-panel" id="beta">
            <div className="beta-copy">
              <p className="section-index">Limited Early Access</p>
              <h2 id="beta-title">Bring your wardrobe into the beta.</h2>
              <p>We’re opening AURA slowly to improve quality, control AI costs, and learn from real wardrobes.</p>
              <p className="small-note">Limited spots. iOS beta invites first. AI suggestions can make mistakes and are improving during beta.</p>
            </div>
            <form className="waitlist-form" onSubmit={submitWaitlist}>
              <label><span>Name</span><input name="name" type="text" autoComplete="name" minLength={2} maxLength={120} disabled={isSubmitting} required /></label>
              <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} disabled={isSubmitting} required /></label>
              <label className="form-honeypot" aria-hidden="true"><span>Company</span><input name="company" type="text" autoComplete="off" tabIndex={-1} /></label>
              <div className="waitlist-action">
                <motion.button className="button button-primary" type="submit" disabled={isSubmitting} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                  {isSubmitting ? "Joining…" : "Request Early Access"} <ArrowIcon />
                </motion.button>
                <span>Limited iOS Early Access</span>
              </div>
              <p className="waitlist-expectation">We review requests in small batches and email invitations as spots open.</p>
              <p className={`form-status is-${formState}`} role="status" aria-live="polite">{formStatus}</p>
            </form>
          </Reveal>
        </section>

        <section className="section-shell section-block faq-section" aria-labelledby="faq-title">
          <Reveal className="section-heading split-heading" id="faq">
            <p className="section-index">05 / Questions</p><h2 id="faq-title">Before you request access.</h2>
          </Reveal>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => {
              const isOpen = openFaq === index;
              return (
                <Reveal key={question} delay={(index % 2) * 0.04}>
                  <article className={`faq-item ${isOpen ? "is-open" : ""}`}>
                    <button type="button" aria-expanded={isOpen} aria-controls={`faq-answer-${index}`} onClick={() => setOpenFaq(isOpen ? null : index)}>
                      <span>{question}</span><i>{isOpen ? "−" : "+"}</i>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && <motion.div id={`faq-answer-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }}><p>{answer}</p></motion.div>}
                    </AnimatePresence>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div><a className="wordmark" href="#top" aria-label="AURA home"><BrandLogo /></a><p>AI personal stylist for your real wardrobe.</p></div>
        <nav aria-label="Footer links"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a><a href="/support">Support</a><a href="/support">Contact</a><a href="/delete-account">Delete Account</a></nav>
        <p>© 2026 AURA. All rights reserved.</p>
      </footer>
    </MotionConfig>
  );
}
