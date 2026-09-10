'use client';

import { useState, type FormEvent } from 'react';
import type { AvailabilityQuery, MissingAvailabilityField } from '@/lib/api-types';

interface Props {
  missing: MissingAvailabilityField[];
  partial: Partial<AvailabilityQuery>;
  onSubmit: (params: AvailabilityQuery) => void;
  disabled?: boolean;
}

/**
 * Renders inputs ONLY for the fields the backend reported missing.
 * Already-known fields (`partial`) are merged back in on submit rather than
 * re-collected, so a value the guest already gave isn't asked for twice.
 */
export default function AvailabilityForm({ missing, partial, onSubmit, disabled }: Props) {
  const [checkIn, setCheckIn] = useState(partial.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(partial.checkOut ?? '');
  const [adults, setAdults] = useState(partial.adults ?? 1);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ checkIn, checkOut, adults });
  }

  const canSubmit =
    checkIn.length > 0 && checkOut.length > 0 && adults > 0 && checkOut > checkIn;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {missing.includes('checkIn') && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Check-in</span>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
            disabled={disabled}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      )}
      {missing.includes('checkOut') && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Check-out</span>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
            disabled={disabled}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      )}
      {missing.includes('adults') && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Guests</span>
          <input
            type="number"
            min={1}
            max={10}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            required
            disabled={disabled}
            className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={disabled || !canSubmit}
        className="rounded-lg bg-zinc-900 px-4 py-1.5 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-black"
      >
        Check availability
      </button>
      {checkIn && checkOut && checkOut <= checkIn && (
        <p className="w-full text-xs text-red-500">Check-out must be after check-in.</p>
      )}
    </form>
  );
}
