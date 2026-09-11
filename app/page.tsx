import BackgroundDecor from '@/components/BackgroundDecor';
import Chat from '@/components/Chat';

export default function Home() {
  return (
    <div className="relative flex h-[100dvh] w-full justify-center overflow-hidden">
      <BackgroundDecor />
      {/* The chat panel: full-bleed on mobile (no room to spare), a
          bounded, bordered card with breathing room on larger screens —
          where the surrounding space is now the decorated backdrop above
          instead of flat, empty canvas. */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-zinc-200/80 sm:shadow-2xl sm:shadow-zinc-900/10 dark:bg-zinc-950 dark:sm:border-zinc-800/80 dark:sm:shadow-black/50">
        <Chat />
      </div>
    </div>
  );
}
