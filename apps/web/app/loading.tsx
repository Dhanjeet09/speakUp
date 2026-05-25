import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 gap-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <div className="grid gap-4 w-full max-w-2xl mt-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
