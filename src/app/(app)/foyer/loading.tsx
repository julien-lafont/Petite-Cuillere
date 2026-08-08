import { PageHeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <CardListSkeleton count={3} className="h-44" />
    </div>
  );
}
