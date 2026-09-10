/**
 * Purely decorative page backdrop — sits behind the chat panel so the
 * space around it (visible once the panel is bounded, on wider windows)
 * reads as an intentional, branded page rather than empty canvas.
 * `aria-hidden` + no interactive content, so it's invisible to the
 * accessibility tree and to component tests (Chat.tsx renders separately).
 */
export default function BackgroundDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[linear-gradient(160deg,#fdf8f0_0%,#eef5f4_45%,#e4f0ef_100%)] dark:bg-[linear-gradient(160deg,#05080a_0%,#0a1416_55%,#071012_100%)]"
    >
      {/* Soft color blobs for depth, not flat emptiness */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl dark:bg-teal-900/25" />
      <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl dark:bg-amber-900/10" />
      <div className="absolute bottom-10 left-1/4 h-72 w-72 rounded-full bg-teal-100/40 blur-3xl dark:bg-teal-800/15" />

      {/* Oversized wordmark watermark, barely-there opacity */}
      <span className="font-display absolute -left-6 -top-10 select-none text-[clamp(200px,26vw,460px)] italic leading-none text-teal-900/[.035] dark:text-teal-100/[.045]">
        H
      </span>

      {/* Brand corner marks — only where there's room to breathe */}
      <div className="absolute left-6 top-6 hidden flex-col gap-0.5 sm:flex lg:left-10 lg:top-10">
        <span className="font-display text-lg italic text-zinc-800/70 dark:text-zinc-200/70">
          Harborview
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500/70 dark:text-zinc-400/60">
          Grand Hotel
        </span>
      </div>
      <div className="absolute bottom-6 right-6 hidden text-right sm:block lg:bottom-10 lg:right-10">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500/60 dark:text-zinc-400/50">
          Guest Services, Reimagined
        </span>
      </div>

      {/* Harbor wave silhouette along the bottom edge */}
      <svg
        className="absolute bottom-0 left-0 h-40 w-full text-teal-900/[.05] dark:text-teal-100/[.06]"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M0 120C240 40 480 180 720 100C960 20 1200 160 1440 90V220H0V120Z" fill="currentColor" />
        <path
          d="M0 170C260 110 500 200 740 150C980 100 1220 190 1440 150V220H0V170Z"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}
