import type { LocationCoords } from '../types';

export const KNOWN_SMART_CITY_LANDMARKS: LocationCoords[] = [
  {
    latitude: 12.9213,
    longitude: 79.1353,
    address: 'Gandhi Road, Kosapet, Vellore, Tamil Nadu, 632008, India',
    ward: 'Kosapet',
    zone: 'Vellore',
    landmark: 'Gandhi Road'
  },
  {
    latitude: 12.9347,
    longitude: 79.1370,
    address: 'Vellore New Bus Stand, NH75, Sathuvachari, Vellore, Tamil Nadu, 632009, India',
    ward: 'Sathuvachari',
    zone: 'Vellore',
    landmark: 'Vellore New Bus Stand'
  },
  {
    latitude: 13.0824,
    longitude: 80.2760,
    address: 'Puratchi Thalaivar Dr. M.G. Ramachandran Central, Chennai, Tamil Nadu, 600001, India',
    ward: 'Ward 59',
    zone: 'Zone 5 (Royapuram)',
    landmark: 'Chennai Central'
  },
  {
    latitude: 13.0850,
    longitude: 80.2101,
    address: '2nd Avenue, Near Roundtana, Anna Nagar, Chennai, Tamil Nadu',
    ward: 'Ward 102',
    zone: 'Zone 8 (Anna Nagar)',
    landmark: 'Anna Nagar Roundtana'
  },
  {
    latitude: 13.0418,
    longitude: 80.2341,
    address: 'Usman Road, T. Nagar, Chennai, Tamil Nadu',
    ward: 'Ward 134',
    zone: 'Zone 10 (T. Nagar)',
    landmark: 'Ranganathan Street Junction'
  },
  {
    latitude: 13.0067,
    longitude: 80.2206,
    address: 'Gandhi Nagar 3rd Cross Street, Adyar, Chennai, Tamil Nadu',
    ward: 'Ward 173',
    zone: 'Zone 13 (Adyar)',
    landmark: 'Adyar Bus Depot'
  }
];

function formatNominatimItem(item: any): LocationCoords {
  const addr = item.address || {};
  const ward = addr.suburb || addr.neighbourhood || addr.subdistrict || addr.ward || '';
  const zone = addr.city_district || addr.city || addr.town || addr.municipality || addr.county || '';
  const landmark = addr.road || item.name || addr.amenity || (item.display_name ? item.display_name.split(',')[0].trim() : 'Location Pin');

  return {
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    address: item.display_name,
    ward,
    zone,
    landmark
  };
}

/**
 * Search locations and addresses across maps via backend proxy or direct Nominatim
 */
export async function searchLocations(query: string): Promise<LocationCoords[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return KNOWN_SMART_CITY_LANDMARKS;
  }

  // 1. Try Backend Proxy endpoint (/api/location/search)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`/api/location/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('Backend location search proxy failed, trying direct geocoder:', err);
  }

  // 2. Direct browser fallback to OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const directUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=8`;
    const res = await fetch(directUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });
    clearTimeout(timer);

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        return items.map(formatNominatimItem);
      }
    }
  } catch (err) {
    console.warn('Direct Nominatim geocoding failed:', err);
  }

  // 3. Fallback to local landmark matches
  const q = trimmed.toLowerCase();
  const matched = KNOWN_SMART_CITY_LANDMARKS.filter(
    (item) =>
      item.address.toLowerCase().includes(q) ||
      item.landmark?.toLowerCase().includes(q) ||
      item.zone?.toLowerCase().includes(q)
  );

  return matched.length > 0 ? matched : KNOWN_SMART_CITY_LANDMARKS;
}

/**
 * Reverse-geocode coordinates into real street address and administrative details
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<LocationCoords> {
  // 1. Try Backend Proxy endpoint (/api/location/reverse)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.data && json.data.address) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('Backend reverse-geocode proxy failed, trying direct:', err);
  }

  // 2. Direct browser fallback to OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const directUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(directUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });
    clearTimeout(timer);

    if (res.ok) {
      const item = await res.json();
      if (item && item.display_name) {
        return formatNominatimItem(item);
      }
    }
  } catch (err) {
    console.warn('Direct reverse geocode failed:', err);
  }

  // 3. Fallback: check closest known landmark
  let closest = KNOWN_SMART_CITY_LANDMARKS[0];
  let minDiff = 999999;
  for (const lm of KNOWN_SMART_CITY_LANDMARKS) {
    const diff = Math.hypot(lm.latitude - lat, lm.longitude - lng);
    if (diff < minDiff) {
      minDiff = diff;
      closest = lm;
    }
  }

  if (minDiff < 0.01) {
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
    address: `Grievance Site (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`,
    ward: 'Ward Field Area',
    zone: 'Smart City Urban Zone',
    landmark: 'Custom Map Pinpoint'
  };
}

/**
 * Get device GPS location and reverse-geocode to get real address
 */
export async function getCurrentBrowserLocation(): Promise<LocationCoords> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(KNOWN_SMART_CITY_LANDMARKS[0]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const detailed = await reverseGeocodeCoordinates(
            position.coords.latitude,
            position.coords.longitude
          );
          resolve(detailed);
        } catch {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: `Live GPS Location (${position.coords.latitude.toFixed(4)}° N, ${position.coords.longitude.toFixed(4)}° E)`,
            ward: 'Ward 102',
            zone: 'Smart City Division',
            landmark: 'Device GPS'
          });
        }
      },
      () => {
        resolve(KNOWN_SMART_CITY_LANDMARKS[0]);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

/**
 * Synchronous search helper for backward compatibility
 */
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
