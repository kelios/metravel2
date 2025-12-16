const MapClickHandler = ({
     onSelectPoint,
     useMapEvents,
 }: {
     onSelectPoint: (lng: number, lat: number) => void;
     useMapEvents: (handlers: any) => void;
 }) => {
     useMapEvents({
         click(e: any) {
             onSelectPoint(e.latlng.lng, e.latlng.lat);
         },
     });
     return null;
 };

export default MapClickHandler;
