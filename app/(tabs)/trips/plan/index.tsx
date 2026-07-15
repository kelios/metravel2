import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PlannedTripsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/trips/my');
  }, [router]);

  return null;
}
