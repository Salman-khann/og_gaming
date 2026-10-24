import { ShimmerLoader } from '@/components/ui/shimmer-loader';
export default function Loading() {
  return (
    <main className="wrap arena-main">
      <ShimmerLoader
        showPercent={false}
        labels={['Loading the arena...', 'Preparing your next page...']}
      />
    </main>
  );
}
