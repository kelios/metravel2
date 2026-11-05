import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import type { ErrorBoundaryProps } from 'expo-router'
import LoaderScreenErrorBoundary from '@/components/ui/LoaderScreenErrorBoundary'
import { isExpoLoaderError } from '@/components/ui/ErrorBoundary'
import TravelDetailsLoadingFallback from './TravelDetailsLoadingFallback'
import { loadTravelOfflineReader } from './loadTravelOfflineReader.web'

const TravelOfflineReader = lazy(loadTravelOfflineReader)

const subscribe = (listener: () => void) => onlineManager.subscribe(listener)
const getOnline = () => onlineManager.isOnline()
const getServerOnline = () => true

/** A failed network loader must not hide the existing local-package reader. */
export default function TravelLoaderErrorBoundary(props: ErrorBoundaryProps) {
  const online = useSyncExternalStore(subscribe, getOnline, getServerOnline)
  const loaderError = isExpoLoaderError(props.error)
  const [useLocalReader, setUseLocalReader] = useState(false)

  useEffect(() => {
    if (loaderError && !online) setUseLocalReader(true)
  }, [loaderError, online])

  // Keep the reader mounted on reconnect: its query refreshes in the background.
  if (loaderError && (!online || useLocalReader)) return <Suspense fallback={<TravelDetailsLoadingFallback />}><TravelOfflineReader /></Suspense>
  return <LoaderScreenErrorBoundary {...props} />
}
