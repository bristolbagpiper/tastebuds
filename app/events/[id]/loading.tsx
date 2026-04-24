import { AppPageSkeleton } from '@/components/app/LoadingSkeleton'

export default function Loading() {
  return <AppPageSkeleton currentPath="/events" title="Event detail" variant="detail" />
}
