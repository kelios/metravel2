import MyTripsDashboard from '@/components/trips/MyTripsDashboard';
import TripsPageSeo from '@/components/trips/TripsPageSeo';

export default function MyTripsScreen() {
  return (
    <>
      <TripsPageSeo
        canonicalPath="/trips/my"
        fallbackTitle="myTrips"
      />
      <MyTripsDashboard />
    </>
  );
}
