import { Skeleton } from "@/components/ui/skeleton";

export default function MatchLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 gap-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-80" />
      <Skeleton className="h-48 w-80 rounded-card" />
    </div>
  );
}
