import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="pt-8 border-t border-gray-200">
        <Skeleton className="h-10 w-32 bg-danger/20" />
      </div>
    </div>
  );
}
