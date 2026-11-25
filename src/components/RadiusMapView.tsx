import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';
import type { AreaUnit, PropertyListing, SearchCenter } from '../types/rental';
import { formatArea, formatINR } from '../lib/geo';

interface PropertyWithDistance extends PropertyListing {
  distanceKm: number;
}

interface RadiusMapViewProps {
  center: SearchCenter;
  radiusKm: number;
  properties: PropertyWithDistance[];
  areaUnit: AreaUnit;
  selectedPropertyId: string | null;
  onSelectProperty: (property: PropertyListing) => void;
  onChangeCenter: (center: SearchCenter) => void;
  hasApiKey: boolean;
}

function getZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 3) return 13;
  if (radiusKm <= 6) return 12;
  if (radiusKm <= 12) return 11;
  if (radiusKm <= 25) return 10;
  return 9;
}

const RadiusCircleAndCamera: React.FC<{
  center: SearchCenter;
  radiusKm: number;
}> = ({ center, radiusKm }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: center.lat, lng: center.lng });
    map.setZoom(getZoomForRadius(radiusKm));
  }, [map, center.lat, center.lng, radiusKm]);

  useEffect(() => {
    if (!map || !mapsLib?.Circle) return;

    const circle = new mapsLib.Circle({
      map,
      center: { lat: center.lat, lng: center.lng },
      radius: radiusKm * 1000,
      strokeColor: '#0F5257',
      strokeOpacity: 0.75,
      strokeWeight: 2,
      fillColor: '#0D9488',
      fillOpacity: 0.11,
      clickable: false,
    });

    return () => {
      circle.setMap(null);
    };
  }, [map, mapsLib, center.lat, center.lng, radiusKm]);

  return null;
};

export const RadiusMapView: React.FC<RadiusMapViewProps> = ({
  center,
  radiusKm,
  properties,
  areaUnit,
  selectedPropertyId,
  onSelectProperty,
  onChangeCenter,
  hasApiKey,
}) => {
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();
  const [activeInfoProp, setActiveInfoProp] = useState<PropertyWithDistance | null>(null);

  const handleMapClick = (ev: MapMouseEvent) => {
    const latLng = ev.detail.latLng;
    if (!latLng) return;
    setActiveInfoProp(null);
    onChangeCenter({
      label: `Pinned Area (${latLng.lat.toFixed(3)}, ${latLng.lng.toFixed(3)})`,
      lat: latLng.lat,
      lng: latLng.lng,
    });
  };

  const mapUnavailable =
    !hasApiKey ||
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE;

  if (mapUnavailable) {
    return (
      <div className="w-full h-[440px] lg:h-[580px] rounded-xl border border-slate-200 bg-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <MapPin className="w-8 h-8 text-teal-800" />
        <h3 className="text-base font-semibold text-slate-900">
          {radiusKm} km Radius Active Around {center.label}
        </h3>
        <p className="text-sm text-slate-600 max-w-md">
          Showing {properties.length} rental{' '}
          {properties.length === 1 ? 'home' : 'homes'} within {radiusKm} km calculated via exact GPS coordinates. Interactive map tiles are currently offline.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[440px] lg:h-[580px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
          <span className="text-sm text-slate-500">Loading Google Map...</span>
        </div>
      )}

      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={getZoomForRadius(radiusKm)}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        onClick={handleMapClick}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <RadiusCircleAndCamera center={center} radiusKm={radiusKm} />

        {/* Search Center Pin */}
        <AdvancedMarker position={{ lat: center.lat, lng: center.lng }} title={center.label}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white shadow-md border-2 border-white">
            <Navigation className="w-3.5 h-3.5" />
          </div>
        </AdvancedMarker>

        {/* Property Price Pins */}
        {properties.map((prop) => {
          const isSelected = prop.id === selectedPropertyId || activeInfoProp?.id === prop.id;
          const shortRent =
            prop.monthlyRent >= 1000
              ? `₹${(prop.monthlyRent / 1000).toFixed(prop.monthlyRent % 1000 === 0 ? 0 : 1)}k`
              : `₹${prop.monthlyRent}`;

          return (
            <AdvancedMarker
              key={prop.id}
              position={{ lat: prop.lat, lng: prop.lng }}
              title={`${prop.title} — ${formatINR(prop.monthlyRent)}/mo`}
              onClick={() => setActiveInfoProp(prop)}
              zIndex={isSelected ? 50 : 10}
            >
              <button
                type="button"
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums shadow-md border transition-transform ${
                  isSelected
                    ? 'bg-teal-800 text-white border-teal-950 scale-110'
                    : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {shortRent}
              </button>
            </AdvancedMarker>
          );
        })}

        {activeInfoProp && (
          <InfoWindow
            position={{ lat: activeInfoProp.lat, lng: activeInfoProp.lng }}
            onCloseClick={() => setActiveInfoProp(null)}
            pixelOffset={[0, -34]}
          >
            <div className="w-60 p-1 text-slate-900">
              <div className="aspect-[4/3] w-full rounded-md overflow-hidden bg-slate-100 mb-2">
                <img
                  src={activeInfoProp.photoUrl}
                  alt={activeInfoProp.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs text-slate-500">
                {activeInfoProp.bhkType} · {activeInfoProp.floor} · {activeInfoProp.distanceKm} km
              </div>
              <div className="text-sm font-semibold text-slate-900 line-clamp-1 mt-0.5">
                {activeInfoProp.title}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {formatArea(activeInfoProp.areaGaj, activeInfoProp.areaSqft, areaUnit)}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-sm font-bold text-teal-800 tabular-nums">
                  {formatINR(activeInfoProp.monthlyRent)}/mo
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSelectProperty(activeInfoProp);
                    setActiveInfoProp(null);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-teal-800 rounded-md hover:bg-teal-900 transition-colors"
                >
                  View Home
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Subtle Map Instruction Bar */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 shadow-sm pointer-events-none">
        Showing <span className="font-semibold text-slate-900 tabular-nums">{properties.length}</span>{' '}
        homes within <span className="font-semibold text-teal-800 tabular-nums">{radiusKm} km</span> · Click map to move center
      </div>
    </div>
  );
};
