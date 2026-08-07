import { Skeleton } from './ui/skeleton';

export function LibrarySkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-28 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Skeleton className="h-44 rounded-2xl lg:col-span-1" />
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
