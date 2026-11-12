"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const slides = [
  {
    src: "assets/closet-grid-screen-public.webp",
    label: "Build your digital closet",
    note: "Clean pieces, useful context, everything you own in one place.",
  },
  {
    src: "assets/aura-chat-screen-public.webp",
    label: "Style what you already own",
    note: "Ask for a look and get an answer grounded in your wardrobe.",
  },
  {
    src: "assets/calendar-screen-public.webp",
    label: "Plan the day ahead",
    note: "Carry the finished outfit into your calendar when it matters.",
  },
];

function ReelSlide({
  src,
  label,
  note,
  index,
}: (typeof slides)[number] & { index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame: frame + 8,
    fps,
    config: { damping: 22, mass: 0.7, stiffness: 110 },
  });
  const opacity = interpolate(frame, [0, 62, 78], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(entrance, [0, 1], [50, 0]);
  const scale = interpolate(frame, [0, 78], [1.035, 1]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div className="reel-screen" style={{ transform: `translateY(${y}px) scale(${scale})` }}>
        <Img src={staticFile(src)} className="reel-screen-image" />
      </div>
      <div className="reel-caption" style={{ transform: `translateY(${y * 0.5}px)` }}>
        <span>0{index + 1}</span>
        <strong>{label}</strong>
        <p>{note}</p>
      </div>
    </AbsoluteFill>
  );
}

function ReelProgress() {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, 239], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div className="reel-progress"><span style={{ width: `${width}%` }} /></div>;
}

function AuraReelComposition() {
  return (
    <AbsoluteFill className="reel-canvas">
      <div className="reel-aura-mark">AURA / PRODUCT TOUR</div>
      <ReelProgress />
      {slides.map((slide, index) => (
        <Sequence key={slide.src} from={index * 80} durationInFrames={80} premountFor={12}>
          <ReelSlide {...slide} index={index} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export function AuraReel() {
  const reduceMotion = useReducedMotion();
  const playerRef = useRef<PlayerRef>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const updateActiveSlide = ({ detail }: { detail: { frame: number } }) => {
      setActiveSlide(Math.min(slides.length - 1, Math.floor(detail.frame / 80)));
    };

    player.addEventListener("frameupdate", updateActiveSlide);
    return () => player.removeEventListener("frameupdate", updateActiveSlide);
  }, []);

  function selectSlide(index: number) {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(index * 80 + 8);
    setActiveSlide(index);
    if (!reduceMotion) player.play();
  }

  return (
    <div className="reel-shell">
      <div className="reel-player" aria-label="Animated preview of the AURA app">
        <Player
          ref={playerRef}
          component={AuraReelComposition}
          durationInFrames={240}
          compositionWidth={1000}
          compositionHeight={600}
          fps={30}
          autoPlay={!reduceMotion}
          initialFrame={reduceMotion ? 30 : 0}
          loop
          controls={false}
          clickToPlay={false}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="reel-navigation" aria-label="Product tour steps">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            className={activeSlide === index ? "is-active" : ""}
            aria-pressed={activeSlide === index}
            onClick={() => selectSlide(index)}
          >
            <span>0{index + 1}</span>
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  );
}
