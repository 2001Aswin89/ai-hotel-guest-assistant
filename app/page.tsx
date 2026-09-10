import Chat from '@/components/Chat';

export default function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-white dark:bg-black sm:min-h-screen sm:bg-zinc-50 sm:p-4">
      <Chat />
    </div>
  );
}
