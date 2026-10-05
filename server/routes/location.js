'use strict';

const express = require('express');
const router = express.Router();

// Simple in-memory cache to prevent redundant queries and respect rate limits
const searchCache = new Map();
const reverseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Known fallback landmarks for offline/demo reliability
const FALLBACK_LANDMARKS = [
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
    address: '2nd Avenue, Near Roundtana, Anna Nagar, Chennai, Tamil Nadu, 600040, India',
    ward: 'Ward 102',
    zone: 'Zone 8 (Anna Nagar)',
    landmark: 'Anna Nagar Roundtana'
  },
  {
    latitude: 13.0418,
    longitude: 80.2341,
    address: 'Usman Road, T. Nagar, Chennai, Tamil Nadu, 600017, India',
    ward: 'Ward 134',
    zone: 'Zone 10 (T. Nagar)',
    landmark: 'Ranganathan Street Junction'
  }
];

function extractWardZoneLandmark(item) {
  const addr = item.address || {};
  const ward = addr.suburb || addr.neighbourhood || addr.subdistrict || addr.ward || '';
  const zone = addr.city_district || addr.city || addr.town || addr.municipality || addr.county || '';
  const landmark = addr.road || item.name || addr.amenity || addr.building || (item.display_name ? item.display_name.split(',')[0].trim() : '');

  return { ward, zone, landmark };
}

/**
 * GET /api/location/search?q=<query>
 * Geocode address or landmark into coordinates and formatted place details
 */
router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query || query.length < 2) {
    return res.json({
      success: true,
      count: FALLBACK_LANDMARKS.length,
      data: FALLBACK_LANDMARKS
    });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      success: true,
      count: cached.data.length,
      cached: true,
      data: cached.data
    });
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=8`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmartCitizenGrievanceSystem/1.0 (contact@smartcitizen.gov)',
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim responded with status ${response.status}`);
    }

    const items = await response.json();

    const formatted = items.map((item) => {
      const { ward, zone, landmark } = extractWardZoneLandmark(item);
      return {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        address: item.display_name,
        ward,
        zone,
        landmark
      };
    });

    // If external service returned results, cache and return them
    if (formatted.length > 0) {
      searchCache.set(cacheKey, { timestamp: Date.now(), data: formatted });
      return res.json({
        success: true,
        count: formatted.length,
        data: formatted
      });
    }

    // If no results from Nominatim, fallback to local match
    const qLower = query.toLowerCase();
    const localMatches = FALLBACK_LANDMARKS.filter(
      (lm) =>
        lm.address.toLowerCase().includes(qLower) ||
        lm.landmark.toLowerCase().includes(qLower) ||
        lm.zone.toLowerCase().includes(qLower)
    );

    return res.json({
      success: true,
      count: localMatches.length,
      data: localMatches
    });
  } catch (err) {
    console.warn(`Location search failed for "${query}":`, err.message);

    // Fallback on error
    const qLower = query.toLowerCase();
    const fallbackResults = FALLBACK_LANDMARKS.filter(
      (lm) =>
        lm.address.toLowerCase().includes(qLower) ||
        lm.landmark.toLowerCase().includes(qLower)
    );

    return res.json({
      success: true,
      count: fallbackResults.length,
      fallback: true,
      data: fallbackResults.length > 0 ? fallbackResults : FALLBACK_LANDMARKS
    });
  }
});

/**
 * GET /api/location/reverse?lat=<lat>&lng=<lng>
 * Reverse-geocode coordinates into street address and administrative division
 */
router.get('/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid coordinates: lat and lng must be valid numbers'
    });
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      success: true,
      cached: true,
      data: cached.data
    });
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmartCitizenGrievanceSystem/1.0 (contact@smartcitizen.gov)',
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim reverse responded with status ${response.status}`);
    }

    const item = await response.json();
    const { ward, zone, landmark } = extractWardZoneLandmark(item);

    const result = {
      latitude: lat,
      longitude: lng,
      address: item.display_name || `Location at ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
      ward: ward || 'Ward Unknown',
      zone: zone || 'Municipal Division',
      landmark: landmark || 'Selected Location Pin'
    };

    reverseCache.set(cacheKey, { timestamp: Date.now(), data: result });

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.warn(`Reverse geocode failed for [${lat}, ${lng}]:`, err.message);

    // Fallback: check closest known landmark
    let closest = FALLBACK_LANDMARKS[0];
    let minDiff = 999999;
    for (const lm of FALLBACK_LANDMARKS) {
      const diff = Math.hypot(lm.latitude - lat, lm.longitude - lng);
      if (diff < minDiff) {
        minDiff = diff;
        closest = lm;
      }
    }

    if (minDiff < 0.01) {
      return res.json({
        success: true,
        fallback: true,
        data: {
          latitude: lat,
          longitude: lng,
          address: closest.address,
          ward: closest.ward,
          zone: closest.zone,
          landmark: closest.landmark
        }
      });
    }

    return res.json({
      success: true,
      fallback: true,
      data: {
        latitude: lat,
        longitude: lng,
        address: `Grievance Site (${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E)`,
        ward: 'Ward Field Area',
        zone: 'Smart City Urban Zone',
        landmark: 'Marked Map Location'
      }
    });
  }
});

module.exports = router;
