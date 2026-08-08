import { PageHeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardListSkeleton count={4} className="h-28" />
    </div>
  );
}
