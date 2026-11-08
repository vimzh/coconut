"use client";

// A standalone presentation shell with bounded keyboard and button navigation.
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import styles from "./pitch.module.css";

export function PitchDeck({ children, titles }: { children: ReactNode; titles: readonly string[] }) {
  const slides = Children.toArray(children);
  const [active, setActive] = useState(0);
  const stage = useRef<HTMLElement>(null);
  const count = slides.length;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role='textbox']")))) return;

      let direction: number;
      switch (event.key) {
        case "ArrowRight": case "PageDown": direction = 1; break;
        case "ArrowLeft": case "PageUp": direction = -1; break;
        case "Home": direction = -count; break;
        case "End": direction = count; break;
        default: return;
      }
      event.preventDefault();
      setActive((index) => Math.max(0, Math.min(count - 1, index + direction)));
      stage.current?.scrollTo({ top: 0 });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count]);

  function move(direction: number) {
    setActive((index) => Math.max(0, Math.min(count - 1, index + direction)));
    stage.current?.scrollTo({ top: 0 });
  }

  return (
    <div className={styles.deck}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}><Image src="/coconut.svg" width={36} height={36} alt="" className={styles.logo} /><span>CoconutEval<span className={styles.wordmarkDot}>.</span></span></Link>
        <span className={styles.headerNote}>Testing how models classify functions</span>
        <Link href="/evaluate" className={styles.headerLink}>Open evaluation <ArrowRight size={14} aria-hidden="true" /></Link>
      </header>

      <main ref={stage} className={styles.stage} id="pitch-content" tabIndex={-1}>
        <section key={active} className={styles.slide} aria-roledescription="slide" aria-label={`${active + 1} of ${count}: ${titles[active]}`}>
          {slides[active]}
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.keyboardHint}><span>←</span><span>→</span> to change slides</p>
        <div className={styles.slideTrack} aria-hidden="true">
          {titles.map((title, index) => <span key={title} data-active={index === active} />)}
        </div>
        <nav className={styles.controls} aria-label="Slide navigation">
          <p className={styles.counter} aria-live="polite" aria-atomic="true">
            <span className="sr-only">{titles[active]}, slide </span>
            {String(active + 1).padStart(2, "0")} <span className={styles.counterDivider}>/</span> {String(count).padStart(2, "0")}
          </p>
          <Button variant="outline" size="icon-lg" className={styles.arrowButton} onClick={() => move(-1)} disabled={active === 0} aria-label="Previous slide">
            <ArrowLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon-lg" className={styles.arrowButton} onClick={() => move(1)} disabled={active === count - 1} aria-label="Next slide">
            <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      </footer>
    </div>
  );
}
