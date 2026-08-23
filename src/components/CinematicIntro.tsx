"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

type PillMode = "enter" | "skip";
type SceneName = "car" | "boat" | "plane";

type Cam = {
  scale: number;
  x: number;
  y: number;
  bright: number;
  contrast: number;
};

type Beat = {
  scene: SceneName;
  src: string;
  startAt: number;
  caption: string;
  /** Wide starting frame */
  wide: Cam;
  /** Tight cinematic push-in */
  close: Cam;
};

const BEATS: Beat[] = [
  {
    scene: "car",
    src: "/videos/car.mp4?v=2",
    startAt: 0.15,
    caption: "LAND",
    wide: { scale: 1.08, x: 0.03, y: 0.02, bright: 0.78, contrast: 1.22 },
    close: { scale: 1.58, x: 0.08, y: -0.04, bright: 0.98, contrast: 1.38 },
  },
  {
    scene: "boat",
    src: "/videos/boat.mp4?v=2",
    startAt: 0.35,
    caption: "SEA",
    wide: { scale: 1.06, x: -0.03, y: 0.03, bright: 0.72, contrast: 1.28 },
    close: { scale: 1.52, x: -0.05, y: 0.02, bright: 0.92, contrast: 1.34 },
  },
  {
    scene: "plane",
    src: "/videos/plane.mp4?v=2",
    startAt: 0.12,
    caption: "AIR",
    wide: { scale: 1.1, x: 0.02, y: 0, bright: 0.84, contrast: 1.16 },
    close: { scale: 1.62, x: 0.04, y: -0.02, bright: 1.05, contrast: 1.3 },
  },
];

const ZOOM_IN_MS = 2800;
const HOLD_MS = 900;
const ZOOM_OUT_MS = 2000;
const CROSSFADE_AT = 0.38; // swap mid zoom-out

const IDLE_CAM: Cam = {
  scale: 1.1,
  x: 0,
  y: 0,
  bright: 0.88,
  contrast: 1.1,
};

export function CinematicIntro() {
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const finished = useRef(false);
  const holdTimer = useRef(0);
  const runId = useRef(0);
  const raf = useRef(0);

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeSlot = useRef<"a" | "b">("a");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  const brandRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const siteRef = useRef<HTMLElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  const cam = useRef<Cam>({ ...IDLE_CAM });
  const fade = useRef({ value: 1 });
  const preloadDone = useRef(false);

  function activeVideo() {
    return activeSlot.current === "a" ? videoARef.current : videoBRef.current;
  }

  function inactiveVideo() {
    return activeSlot.current === "a" ? videoBRef.current : videoARef.current;
  }

  function setPill(mode: PillMode) {
    const btn = btnRef.current;
    const label = labelRef.current;
    if (!btn || !label) return;
    btn.classList.toggle("is-skip", mode === "skip");
    label.textContent = mode === "skip" ? "SKIP INTRO" : "ENTER";
  }

  function showCaption(text: string, delay = 0) {
    const el = captionRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    el.textContent = text;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, letterSpacing: "0.55em" },
      {
        autoAlpha: 1,
        y: 0,
        letterSpacing: "0.35em",
        duration: 0.85,
        delay,
        ease: "power3.out",
      }
    );
  }

  function hideCaption() {
    const el = captionRef.current;
    if (!el) return Promise.resolve();
    gsap.killTweensOf(el);
    return gsap.to(el, {
      autoAlpha: 0,
      y: -8,
      duration: 0.4,
      ease: "power2.in",
    });
  }

  function paintLoop() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      if (finished.current) return;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const vid = activeVideo();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      if (vid && vid.readyState >= 2) {
        const vw = vid.videoWidth || 1;
        const vh = vid.videoHeight || 1;
        const c = cam.current;
        const cover = Math.max(w / vw, h / vh) * c.scale;
        const dw = vw * cover;
        const dh = vh * cover;
        const dx = (w - dw) / 2 + c.x * w;
        const dy = (h - dh) / 2 + c.y * h;

        ctx.save();
        ctx.globalAlpha = fade.current.value;
        ctx.filter = `brightness(${c.bright}) contrast(${c.contrast}) saturate(0.95)`;
        ctx.drawImage(vid, dx, dy, dw, dh);
        ctx.restore();
      }

      raf.current = window.requestAnimationFrame(draw);
    };

    window.cancelAnimationFrame(raf.current);
    raf.current = window.requestAnimationFrame(draw);
  }

  function loadInto(vid: HTMLVideoElement, src: string, startAt: number) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const seekAndFinish = () => {
        const onSeeked = () => {
          vid.removeEventListener("seeked", onSeeked);
          finish();
        };
        vid.addEventListener("seeked", onSeeked);
        try {
          vid.currentTime = startAt;
        } catch {
          finish();
        }
        window.setTimeout(finish, 280);
      };

      vid.muted = true;
      const already =
        vid.currentSrc && vid.currentSrc.includes(src.split("?")[0]);

      if (!already) {
        const onReady = () => {
          vid.removeEventListener("loadeddata", onReady);
          seekAndFinish();
        };
        vid.src = src;
        vid.load();
        vid.addEventListener("loadeddata", onReady);
        window.setTimeout(finish, 4000);
      } else {
        seekAndFinish();
      }
    });
  }

  async function preloadAll() {
    if (preloadDone.current) return;
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;
    await Promise.all([
      loadInto(a, BEATS[0].src, BEATS[0].startAt),
      loadInto(b, BEATS[1].src, BEATS[1].startAt),
    ]);
    // Warm next clip into idle buffer during cinema
    preloadDone.current = true;
  }

  function animateCamera(
    from: Cam,
    to: Cam,
    durationMs: number,
    ease = "power2.inOut"
  ) {
    gsap.killTweensOf(cam.current);
    Object.assign(cam.current, from);
    return gsap.to(cam.current, {
      scale: to.scale,
      x: to.x,
      y: to.y,
      bright: to.bright,
      contrast: to.contrast,
      duration: durationMs / 1000,
      ease,
    });
  }

  async function swapToBeat(beat: Beat) {
    const nextSlot = activeSlot.current === "a" ? "b" : "a";
    const target =
      nextSlot === "a" ? videoARef.current : videoBRef.current;
    if (!target) return;

    await loadInto(target, beat.src, beat.startAt);
    const prev = activeVideo();
    if (prev && prev !== target) prev.pause();
    activeSlot.current = nextSlot;
    await target.play().catch(() => undefined);
    paintLoop();
  }

  async function flashTransition() {
    const flash = flashRef.current;
    const streak = streakRef.current;
    if (!flash) return;

    const tl = gsap.timeline();
    tl.set(flash, { autoAlpha: 0 });
    tl.to(flash, { autoAlpha: 0.4, duration: 0.1, ease: "power1.out" }, 0);
    if (streak) {
      tl.fromTo(
        streak,
        { autoAlpha: 0, x: "-30%", scaleX: 0.4 },
        {
          autoAlpha: 0.85,
          x: "18%",
          scaleX: 1.15,
          duration: 0.32,
          ease: "power3.out",
        },
        0
      );
      tl.to(
        streak,
        { autoAlpha: 0, x: "70%", duration: 0.32, ease: "power2.in" },
        0.22
      );
    }
    tl.to(flash, { autoAlpha: 0, duration: 0.4, ease: "power2.inOut" }, 0.12);
    await new Promise<void>((resolve) => {
      tl.eventCallback("onComplete", () => resolve());
    });
  }

  /**
   * Zoom IN on detail → hold → zoom OUT.
   * Mid zoom-out, crossfade into the next clip so the pull-back continues on it.
   */
  async function playZoomBeat(
    beat: Beat,
    next: Beat | null,
    id: number,
    opts: { fromWide: boolean }
  ) {
    if (finished.current || runId.current !== id) return;

    // Prefetch next into idle slot
    if (next) {
      const idle = inactiveVideo();
      if (idle) void loadInto(idle, next.src, next.startAt);
    }

    if (opts.fromWide) {
      Object.assign(cam.current, beat.wide);
      fade.current.value = 1;
      showCaption(beat.caption, 0.05);

      // ZOOM IN
      animateCamera(beat.wide, beat.close, ZOOM_IN_MS, "power2.inOut");
      await wait(ZOOM_IN_MS, id);
      if (finished.current || runId.current !== id) return;

      await wait(HOLD_MS, id);
      if (finished.current || runId.current !== id) return;
    } else {
      // Already mid zoom-out from previous transition — settle to wide, then zoom in
      showCaption(beat.caption, 0.15);
      animateCamera(
        { ...cam.current },
        beat.wide,
        ZOOM_OUT_MS * (1 - CROSSFADE_AT),
        "power2.out"
      );
      await wait(ZOOM_OUT_MS * (1 - CROSSFADE_AT), id);
      if (finished.current || runId.current !== id) return;

      animateCamera(beat.wide, beat.close, ZOOM_IN_MS, "power2.inOut");
      await wait(ZOOM_IN_MS, id);
      if (finished.current || runId.current !== id) return;

      await wait(HOLD_MS, id);
      if (finished.current || runId.current !== id) return;
    }

    // ZOOM OUT — if there's a next clip, swap mid-way so we "zoom out of" it
    await hideCaption();
    const outTarget = next
      ? {
          scale: Math.max(beat.close.scale * 0.78, next.close.scale * 0.92),
          x: (beat.close.x + next.wide.x) / 2,
          y: (beat.close.y + next.wide.y) / 2,
          bright: 0.75,
          contrast: 1.2,
        }
      : beat.wide;

    animateCamera({ ...cam.current }, outTarget, ZOOM_OUT_MS, "power2.inOut");

    if (next) {
      const swapAt = ZOOM_OUT_MS * CROSSFADE_AT;
      await wait(swapAt, id);
      if (finished.current || runId.current !== id) return;

      // Keep camera motion continuous; reveal next video under the zoom-out
      fade.current.value = 0.35;
      gsap.to(fade.current, { value: 1, duration: 0.55, ease: "power2.out" });
      void flashTransition();
      await swapToBeat(next);

      await wait(ZOOM_OUT_MS - swapAt, id);
      if (finished.current || runId.current !== id) return;
    } else {
      await wait(ZOOM_OUT_MS, id);
    }
  }

  function wait(ms: number, id: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (runId.current === id && !finished.current) resolve();
        else resolve();
      }, ms);
    });
  }

  async function playTypeBeat(id: number) {
    if (finished.current || runId.current !== id) return;
    await hideCaption();

    const type = typeRef.current;
    if (!type) return;

    // Kill the footage so the logo reads clean on black
    gsap.to(fade.current, { value: 0, duration: 0.55, ease: "power2.inOut" });
    gsap.to(cam.current, {
      bright: 0.1,
      scale: 1.08,
      duration: 0.55,
      ease: "power2.inOut",
    });
    await wait(500, id);
    if (finished.current || runId.current !== id) return;

    videoARef.current?.pause();
    videoBRef.current?.pause();

    gsap.set(type, { autoAlpha: 1 });
    gsap.set(".k-letter", {
      opacity: 0,
      y: 40,
      scale: 1.15,
      filter: "blur(18px)",
    });
    gsap.set(".type-sub", { opacity: 0, y: 12 });
    gsap.set(".type-streak", { autoAlpha: 0, x: "-40%" });

    const tl = gsap.timeline();
    tl.to(
      ".type-streak",
      { autoAlpha: 1, x: "8%", duration: 0.6, ease: "power3.out" },
      0
    );
    tl.to(
      ".k-letter",
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.85,
        stagger: 0.08,
        ease: "power3.out",
      },
      0.1
    );
    tl.to(
      ".type-sub",
      { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" },
      0.55
    );
    tl.to(
      ".type-streak",
      { x: "60%", autoAlpha: 0.2, duration: 0.9, ease: "power2.inOut" },
      0.5
    );

    // Hold the logo on screen
    await wait(3200, id);
    if (finished.current || runId.current !== id) return;

    gsap.to(type, { autoAlpha: 0, duration: 0.55, ease: "power2.in" });
    await wait(400, id);
  }

  function goToSite() {
    if (finished.current) return;
    finished.current = true;
    runId.current += 1;
    window.clearTimeout(holdTimer.current);

    const wipe = wipeRef.current;
    siteRef.current?.classList.add("is-live");

    const tl = gsap.timeline({
      onComplete: () => {
        window.cancelAnimationFrame(raf.current);
        if (introRef.current) introRef.current.style.display = "none";
        document.body.style.overflow = "auto";
        setDone(true);
        videoARef.current?.pause();
        videoBRef.current?.pause();
      },
    });

    // Fade intro → site
    tl.to(
      [btnRef.current, brandRef.current, captionRef.current, typeRef.current],
      { autoAlpha: 0, duration: 0.5, ease: "power2.out" },
      0
    );
    tl.to(fade.current, { value: 0, duration: 0.85, ease: "power2.inOut" }, 0);
    tl.to(grainRef.current, { autoAlpha: 0, duration: 0.5 }, 0);
    tl.to(introRef.current, { autoAlpha: 0, duration: 0.65, ease: "power2.inOut" }, 0.25);

    if (wipe) {
      gsap.set(wipe, { clipPath: "inset(0 0 0 0%)", autoAlpha: 0 });
      tl.to(wipe, { autoAlpha: 1, duration: 1, ease: "power2.out" }, 0.4);
    }
    tl.from(
      ".site-nav",
      { y: -16, autoAlpha: 0, duration: 0.7, ease: "power2.out" },
      0.6
    );
    tl.from(
      ".hero-copy > *",
      { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: "power2.out" },
      0.75
    );
    tl.from(
      ".bottle",
      { y: 48, autoAlpha: 0, duration: 0.85, stagger: 0.06, ease: "power3.out" },
      0.9
    );
  }

  async function playCinema() {
    const id = ++runId.current;
    setPill("enter");
    gsap.to(grainRef.current, { autoAlpha: 0.18, duration: 0.8 });

    // Resume / ensure first beat is playing from boot
    const current = activeVideo();
    if (current) {
      try {
        current.currentTime = BEATS[0].startAt;
      } catch {
        /* ignore */
      }
      await current.play().catch(() => undefined);
    }
    paintLoop();
    gsap.fromTo(
      fade.current,
      { value: 0.75 },
      { value: 1, duration: 0.45, ease: "power2.out" }
    );

    // 1: zoom in on scratches → zoom out into compound
    if (finished.current || runId.current !== id) return;
    await playZoomBeat(BEATS[0], BEATS[1], id, { fromWide: true });

    // 2: settle/zoom in on paste → zoom out into polish
    if (finished.current || runId.current !== id) return;
    await playZoomBeat(BEATS[1], BEATS[2], id, { fromWide: false });

    // 3: settle/zoom in on polishing → zoom out toward logo
    if (finished.current || runId.current !== id) return;
    await playZoomBeat(BEATS[2], null, id, { fromWide: false });

    // 4: logo
    if (finished.current || runId.current !== id) return;
    await playTypeBeat(id);

    // 5: website
    if (finished.current || runId.current !== id) return;
    goToSite();
  }

  function startCinematic() {
    if (started.current || finished.current) return;
    started.current = true;
    window.clearTimeout(holdTimer.current);
    void playCinema();
  }

  async function playBoot() {
    setPill("enter");
    gsap.set(flashRef.current, { autoAlpha: 0 });
    gsap.set(typeRef.current, { autoAlpha: 0 });
    gsap.set(grainRef.current, { autoAlpha: 0.1 });
    gsap.set(streakRef.current, { autoAlpha: 0 });

    await preloadAll();
    const a = videoARef.current;
    if (!a) return;

    activeSlot.current = "a";
    Object.assign(cam.current, { ...BEATS[0].wide, bright: 0.55 });
    fade.current.value = 1;
    await a.play().catch(() => undefined);
    paintLoop();

    showCaption(BEATS[0].caption, 0.4);

    const boot = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      onComplete: () => {
        holdTimer.current = window.setTimeout(() => {
          if (!started.current && !finished.current) startCinematic();
        }, 1400);
      },
    });

    boot.to(brandRef.current, { autoAlpha: 1, duration: 1 }, 0.2);
    boot.to(btnRef.current, { autoAlpha: 1, duration: 0.9 }, 0.45);
    boot.to(
      cam.current,
      {
        scale: BEATS[0].wide.scale,
        bright: BEATS[0].wide.bright,
        contrast: BEATS[0].wide.contrast,
        x: BEATS[0].wide.x,
        y: BEATS[0].wide.y,
        duration: 2.2,
        ease: "power1.out",
      },
      0.1
    );
  }

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.set([brandRef.current, btnRef.current, captionRef.current], {
      autoAlpha: 0,
    });

    if (reduced) {
      gsap.set([brandRef.current, btnRef.current], { autoAlpha: 1 });
      setPill("enter");
      return;
    }

    void playBoot();

    return () => {
      window.clearTimeout(holdTimer.current);
      window.cancelAnimationFrame(raf.current);
      runId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPillClick() {
    if (finished.current) return;
    // ENTER always lets them into the site (fade), never required to start cinema
    goToSite();
  }

  return (
    <>
      <header className="brand-bar">
        <span className="brand-mark" ref={brandRef}>
          ASAP — Precision Detailing
        </span>
      </header>

      <p className="scene-caption" ref={captionRef} />

      <button
        type="button"
        className="pill-btn"
        ref={btnRef}
        onClick={onPillClick}
      >
        <span className="pill-dot" />
        <span className="pill-label" ref={labelRef}>
          ENTER
        </span>
        <span aria-hidden>→</span>
      </button>

      <div className="intro-root" ref={introRef} aria-hidden={done}>
        <section className="scene is-active">
          <div className="scene-media" ref={mediaRef}>
            <video
              ref={videoARef}
              className="intro-video-src"
              muted
              playsInline
              loop
              preload="auto"
            />
            <video
              ref={videoBRef}
              className="intro-video-src"
              muted
              playsInline
              loop
              preload="auto"
            />
            <canvas ref={canvasRef} className="intro-canvas" />
            <div className="vignette" />
            <div className="film-grain" ref={grainRef} aria-hidden />
            <div className="light-flash" ref={flashRef} aria-hidden />
            <div className="whip-streak" ref={streakRef} aria-hidden />
          </div>
        </section>

        <div className="kinetic-wrap" ref={typeRef} aria-hidden>
          <div className="type-streak" />
          <div className="kinetic-stack">
            <div className="kinetic">
              {["A", "S", "A", "P"].map((ch, i) => (
                <span key={`${ch}-${i}`} className="k-letter">
                  {ch}
                </span>
              ))}
            </div>
            <p className="type-sub">Land · Sea · Air</p>
          </div>
        </div>
      </div>

      <main className="site-root" ref={siteRef} aria-hidden={!done}>
        <div className="wipe-mask" ref={wipeRef}>
          <nav className="site-nav">
            <div className="nav-logo">ASAP</div>
            <ul className="nav-links">
              <li>
                <a href="#system">The System</a>
              </li>
              <li>
                <a href="#products">Products</a>
              </li>
              <li>
                <a href="#bundle">Bundle</a>
              </li>
              <li>
                <a href="#reviews">Reviews</a>
              </li>
            </ul>
            <a className="nav-shop" href="#shop">
              Shop
            </a>
          </nav>

          <section className="hero-split">
            <div className="hero-copy">
              <p className="eyebrow">
                THE STANDARD <span>FOR PERFECTION</span>
              </p>
              <h1>
                COMPOUNDS.
                <br />
                SEAL.
                <br />
                PERFECTION.
              </h1>
              <p className="lede">
                From damaged paint to mirror depth — a precision correction
                system engineered for hologram-free finish and lasting
                protection.
              </p>
              <div className="hero-ctas">
                <a className="btn-primary" href="#system">
                  System
                </a>
                <a className="btn-ghost" href="#bundle">
                  Get Bundle
                </a>
              </div>
              <div className="proof">
                <span>3K+</span>
                <span>MADE EU</span>
                <span>★ 4.9</span>
              </div>
            </div>

            <div className="hero-products">
              <div className="products-stage">
                <div className="products-fog" aria-hidden />
                <div className="spot s1" />
                <div className="spot s2" />
                <div className="spot s3" />
                <div className="bottles" aria-hidden>
                  <div className="bottle b1">
                    <span>AX1</span>
                    <i />
                  </div>
                  <div className="bottle b2">
                    <span>AX2</span>
                    <i />
                  </div>
                  <div className="bottle b3">
                    <span>AX3</span>
                    <i />
                  </div>
                  <div className="bottle b4">
                    <span>AX4</span>
                    <i />
                  </div>
                  <div className="bottle b5">
                    <span>AX5</span>
                    <i />
                  </div>
                </div>
                <div className="floor-reflect" />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
