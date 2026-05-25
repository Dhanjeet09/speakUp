import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-card" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
