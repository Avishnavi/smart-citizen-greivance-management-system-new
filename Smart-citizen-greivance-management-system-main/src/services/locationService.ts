import type { LocationCoords } from '../types';
import { delay } from './api';

export const KNOWN_SMART_CITY_LANDMARKS: LocationCoords[] = [
  {
    latitude: 13.0850,
    longitude: 80.2101,
    address: '2nd Avenue, Near Roundtana, Anna Nagar',
    ward: 'Ward 102',
    zone: 'Zone 8 (Anna Nagar)',
    landmark: 'Anna Nagar Roundtana'
  },
  {
    latitude: 13.0822,
    longitude: 80.2155,
    address: '4th Main Road, Shanti Colony, Anna Nagar',
    ward: 'Ward 101',
    zone: 'Zone 8 (Anna Nagar)',
    landmark: 'Shanti Colony Market'
  },
  {
    latitude: 13.0418,
    longitude: 80.2341,
    address: 'Usman Road, T. Nagar',
    ward: 'Ward 134',
    zone: 'Zone 10 (T. Nagar)',
    landmark: 'Ranganathan Street Junction'
  },
  {
    latitude: 13.0067,
    longitude: 80.2206,
    address: 'Gandhi Nagar 3rd Cross Street, Adyar',
    ward: 'Ward 173',
    zone: 'Zone 13 (Adyar)',
    landmark: 'Adyar Bus Depot'
  },
  {
    latitude: 12.9815,
    longitude: 80.2180,
    address: '100 Feet Bypass Road, Velachery',
    ward: 'Ward 178',
    zone: 'Zone 13 (Velachery)',
    landmark: 'Velachery MRTS Station'
  },
  {
    latitude: 13.0339,
    longitude: 80.2680,
    address: 'Luz Church Road, Mylapore',
    ward: 'Ward 124',
    zone: 'Zone 9 (Mylapore)',
    landmark: 'Luz Corner'
  }
];

export async function getCurrentBrowserLocation(): Promise<LocationCoords> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(KNOWN_SMART_CITY_LANDMARKS[0]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: 'Detected Live Location via Device GPS',
          ward: 'Ward 102',
          zone: 'Zone 8 (Central)',
          landmark: 'GPS Pin'
        });
      },
      () => {
        resolve(KNOWN_SMART_CITY_LANDMARKS[0]);
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  });
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<LocationCoords> {
  await delay(300);

  let closest = KNOWN_SMART_CITY_LANDMARKS[0];
  let minDiff = 999999;

  for (const lm of KNOWN_SMART_CITY_LANDMARKS) {
    const diff = Math.hypot(lm.latitude - lat, lm.longitude - lng);
    if (diff < minDiff) {
      minDiff = diff;
      closest = lm;
    }
  }

  if (minDiff < 0.005) {
    return {
      latitude: lat,
      longitude: lng,
      address: closest.address,
      ward: closest.ward,
      zone: closest.zone,
      landmark: closest.landmark
    };
  }

  return {
    latitude: parseFloat(lat.toFixed(5)),
    longitude: parseFloat(lng.toFixed(5)),
    address: `Near Geo-Location (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E), Ward 102`,
    ward: 'Ward 102',
    zone: 'Smart City Metro Zone',
    landmark: 'Custom Map Pinpoint'
  };
}

export function searchLandmarkSuggestions(query: string): LocationCoords[] {
  if (!query || query.trim().length === 0) return KNOWN_SMART_CITY_LANDMARKS;
  const q = query.toLowerCase();
  return KNOWN_SMART_CITY_LANDMARKS.filter(
    (item) =>
      item.address.toLowerCase().includes(q) ||
      item.landmark?.toLowerCase().includes(q) ||
      item.zone?.toLowerCase().includes(q)
  );
}
