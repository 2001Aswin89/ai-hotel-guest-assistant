interface Props {
  message: string;
  onRetry: () => void;
  disabled?: boolean;
}

export default function ErrorState({ message, onRetry, disabled }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        Retry
      </button>
    </div>
  );
}
