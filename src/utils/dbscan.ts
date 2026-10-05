import type { Complaint } from '../types';

export interface DBSCANCluster {
  clusterId: number;
  points: Complaint[];
  center: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
  density: number;
  dominantCategory: string;
  categoryBreakdown: Record<string, number>;
  highPriorityCount: number;
  activeCount: number;
}

/**
 * Calculates Haversine distance in meters between two lat/lon coordinates
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Density-Based Spatial Clustering of Applications with Noise (DBSCAN)
 * Used to detect high-density grievance hotspots.
 *
 * @param complaints List of civic complaints with geo-coordinates
 * @param epsilonMeters Distance threshold in meters (neighborhood radius)
 * @param minPts Minimum number of points required to form a dense cluster
 */
export function runDBSCAN(
  complaints: Complaint[],
  epsilonMeters: number = 600,
  minPts: number = 2
): {
  clusters: DBSCANCluster[];
  noisePoints: Complaint[];
} {
  const validPoints = complaints.filter(
    (c) =>
      c.location &&
      typeof c.location.latitude === 'number' &&
      typeof c.location.longitude === 'number' &&
      !isNaN(c.location.latitude) &&
      !isNaN(c.location.longitude)
  );

  const n = validPoints.length;
  const visited = new Set<string>();
  const pointClusterMap = new Map<string, number>(); // complaintId -> clusterId
  let currentClusterId = 0;

  // Helper to find all neighbors within epsilon
  const getNeighbors = (point: Complaint): Complaint[] => {
    const neighbors: Complaint[] = [];
    for (let i = 0; i < n; i++) {
      const other = validPoints[i];
      const dist = haversineDistance(
        point.location.latitude,
        point.location.longitude,
        other.location.latitude,
        other.location.longitude
      );
      if (dist <= epsilonMeters) {
        neighbors.push(other);
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    const p = validPoints[i];
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    const neighbors = getNeighbors(p);

    if (neighbors.length < minPts) {
      // Noise point (or border point evaluated later)
      continue;
    }

    // Start a new dense cluster
    currentClusterId++;
    pointClusterMap.set(p.id, currentClusterId);

    // Queue for cluster expansion
    const neighborQueue = [...neighbors];
    let qIdx = 0;

    while (qIdx < neighborQueue.length) {
      const q = neighborQueue[qIdx];
      qIdx++;

      if (!visited.has(q.id)) {
        visited.add(q.id);
        const qNeighbors = getNeighbors(q);
        if (qNeighbors.length >= minPts) {
          for (const item of qNeighbors) {
            if (!neighborQueue.some((existing) => existing.id === item.id)) {
              neighborQueue.push(item);
            }
          }
        }
      }

      if (!pointClusterMap.has(q.id)) {
        pointClusterMap.set(q.id, currentClusterId);
      }
    }
  }

  // Aggregate clusters
  const clusterMap = new Map<number, Complaint[]>();
  const noisePoints: Complaint[] = [];

  for (const point of validPoints) {
    const cId = pointClusterMap.get(point.id);
    if (cId !== undefined) {
      if (!clusterMap.has(cId)) {
        clusterMap.set(cId, []);
      }
      clusterMap.get(cId)!.push(point);
    } else {
      noisePoints.push(point);
    }
  }

  const clusters: DBSCANCluster[] = [];

  clusterMap.forEach((pts, clusterId) => {
    // Calculate centroid
    const avgLat = pts.reduce((sum, p) => sum + p.location.latitude, 0) / pts.length;
    const avgLng = pts.reduce((sum, p) => sum + p.location.longitude, 0) / pts.length;

    // Find radius (max distance from centroid to any cluster point + padding)
    let maxDist = 0;
    pts.forEach((p) => {
      const d = haversineDistance(avgLat, avgLng, p.location.latitude, p.location.longitude);
      if (d > maxDist) maxDist = d;
    });

    const radiusMeters = Math.max(150, maxDist + 50);

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    let highPriorityCount = 0;
    let activeCount = 0;

    pts.forEach((p) => {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
      if (p.priority === 'High') highPriorityCount++;
      if (p.status === 'Pending' || p.status === 'In Progress') activeCount++;
    });

    // Determine dominant category
    let dominantCategory = 'General';
    let maxCount = 0;
    Object.entries(categoryBreakdown).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = cat;
      }
    });

    clusters.push({
      clusterId,
      points: pts,
      center: {
        latitude: avgLat,
        longitude: avgLng,
      },
      radiusMeters,
      density: pts.length,
      dominantCategory,
      categoryBreakdown,
      highPriorityCount,
      activeCount,
    });
  });

  // Sort clusters by density descending (most critical hotspots first)
  clusters.sort((a, b) => b.density - a.density);

  return { clusters, noisePoints };
}
