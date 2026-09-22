import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useComplaints } from '../../context/ComplaintContext';
import {
  getCurrentBrowserLocation,
  reverseGeocodeCoordinates,
  searchLandmarkSuggestions
} from '../../services/locationService';
import type { LocationCoords } from '../../types';
import {
  MapPin,
  Navigation,
  Search,
  ArrowRight,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapEventsHandler({
  onLocationChange
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

interface Step2LocationPickerProps {
  onNext: () => void;
  onBack: () => void;
}

export const Step2LocationPicker: React.FC<Step2LocationPickerProps> = ({
  onNext,
  onBack
}) => {
  const { draft, updateDraft } = useComplaints();
  const [coords, setCoords] = useState<LocationCoords>(draft.location);
  const [isDetectingGPS, setIsDetectingGPS] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const center: [number, number] = useMemo(
    () => [coords.latitude, coords.longitude],
    [coords.latitude, coords.longitude]
  );

  const suggestions = useMemo(
    () => searchLandmarkSuggestions(searchQuery),
    [searchQuery]
  );

  const handleGPSDetect = async () => {
    setIsDetectingGPS(true);
    try {
      const gpsLoc = await getCurrentBrowserLocation();
      const detailed = await reverseGeocodeCoordinates(gpsLoc.latitude, gpsLoc.longitude);
      setCoords(detailed);
      updateDraft({ location: detailed });
    } catch (e) {
      console.error('GPS Detection failed:', e);
    } finally {
      setIsDetectingGPS(false);
    }
  };

  const handleMapPinMove = async (lat: number, lng: number) => {
    const detailed = await reverseGeocodeCoordinates(lat, lng);
    setCoords(detailed);
    updateDraft({ location: detailed });
  };

  const handleSelectLandmark = (lm: LocationCoords) => {
    setCoords(lm);
    updateDraft({ location: lm });
    setSearchQuery(lm.landmark || lm.address);
    setShowSuggestions(false);
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-sky-100 text-sky-800 rounded-lg">
              Step 2 of 4
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Pinpoint Grievance Location
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Use GPS or click/drag the map pin to mark the exact civic problem site.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGPSDetect}
          disabled={isDetectingGPS}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-sm hover:shadow transition disabled:opacity-50"
        >
          {isDetectingGPS ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          <span>{isDetectingGPS ? 'Detecting GPS...' : '📍 Use Current Location'}</span>
        </button>
      </div>

      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search landmark (e.g. Anna Nagar Roundtana, Usman Road, Adyar Bus Depot)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowSuggestions(false)} />
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectLandmark(item)}
                  className="p-3 hover:bg-sky-50 cursor-pointer transition flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {item.landmark || item.address}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {item.ward} • {item.zone}
                    </span>
                  </div>
                  <span className="text-[11px] text-sky-600 font-semibold">Select →</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-80 sm:h-96 shadow-inner">
        <MapContainer
          center={center}
          zoom={15}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterController center={center} />
          <MapEventsHandler onLocationChange={handleMapPinMove} />
          <Marker
            position={center}
            icon={customMarkerIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                handleMapPinMove(position.lat, position.lng);
              }
            }}
          />
        </MapContainer>

        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-20 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-lg text-xs space-y-1 max-w-sm">
          <div className="flex items-center gap-1.5 text-sky-900 font-bold">
            <MapPin className="w-4 h-4 text-sky-600 flex-shrink-0" />
            <span className="truncate">{coords.address}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="font-mono">{coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E</span>
            <span>•</span>
            <span>{coords.ward}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Street Address
          </span>
          <p className="mt-0.5 font-bold text-slate-800">{coords.address}</p>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Ward & Zone
          </span>
          <p className="mt-0.5 font-bold text-slate-800">
            {coords.ward || 'Ward 102'} ({coords.zone || 'Zone 8'})
          </p>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Geo Coordinates
          </span>
          <p className="mt-0.5 font-mono font-bold text-slate-800">
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs md:text-sm rounded-2xl flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={() => {
            updateDraft({ location: coords });
            onNext();
          }}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs md:text-sm rounded-2xl flex items-center gap-2 shadow-md shadow-sky-600/20 transition hover:scale-[1.01] active:scale-98"
        >
          <span>Next: AI Analysis & Priority</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
