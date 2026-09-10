import Chat from '@/components/Chat';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <Chat />
    </div>
  );
}
