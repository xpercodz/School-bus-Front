import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/theme";

interface RevealProps {
  children: ReactNode;
  /** Delay in ms, used to stagger a short group of blocks. */
  delay?: number;
  className?: string;
}

/**
 * The dashboard's one restrained entrance: a block fades/rises when it first
 * enters the viewport, once. Not applied to every card — only to a screen's
 * heavy blocks, so data screens stay calm. The hidden state is gated behind
 * `html.js` in globals.css, so content is visible if the observer or script
 * never runs. Under reduced motion the finished state is immediate.
 *
 * A block already on screen when the component mounts is shown immediately:
 * it is arriving with the screen (page-enter / row staggering), and adding a
 * second transform here moved the same pixels twice. Only content that enters
 * later on scroll gets the reveal transition.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const rect = node.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    // Top already above the fold (including content scrolled past on a restored
    // position): it is not a scroll arrival.
    if (rect.top < viewport) {
      // The screen's own entrance owns this block. The rect read above already
      // resolved the hidden style, so the transition has to be suppressed
      // inline for this one state change.
      node.style.transition = "none";
      setShown(true);
      const raf = requestAnimationFrame(() => {
        node.style.transition = "";
      });
      return () => cancelAnimationFrame(raf);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      className={`reveal ${shown ? "is-in" : ""} ${className ?? ""}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
