import type { AvailabilityQuery, AvailabilityRoom } from '@/lib/api-types';

interface Props {
  query: AvailabilityQuery;
  rooms: AvailabilityRoom[];
}

export default function AvailabilityResults({ query, rooms }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        {query.checkIn} &rarr; {query.checkOut} &middot; {query.adults} guest(s)
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rooms.map((room) => (
          <div
            key={room.roomType}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{room.roomType}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  room.available
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                }`}
              >
                {room.available ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <span className="text-zinc-500 dark:text-zinc-400">Sleeps up to {room.capacity}</span>
            <span className="text-zinc-900 dark:text-zinc-100">₹{room.price.toLocaleString('en-IN')} / night</span>
          </div>
        ))}
      </div>
    </div>
  );
}
