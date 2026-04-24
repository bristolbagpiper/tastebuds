import { AppPageSkeleton } from '@/components/app/LoadingSkeleton'

export default function Loading() {
  return <AppPageSkeleton currentPath="/restaurants" title="Restaurants" variant="list" />
}
