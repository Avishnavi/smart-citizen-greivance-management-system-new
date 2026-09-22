import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Complaint } from '../../types';
import { runDBSCAN } from '../../utils/dbscan';
import {
  Flame,
  Layers,
  Eye,
  Info,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Custom Marker Icons for Priority Levels using Leaflet divIcon
const createPriorityIcon = (priority: 'High' | 'Medium' | 'Low') => {
  const config = {
    High: {
      bg: 'bg-rose-600',
      border: 'border-rose-300',
      ring: 'ring-rose-400/50',
      pulse: true,
    },
    Medium: {
      bg: 'bg-amber-500',
      border: 'border-amber-200',
      ring: 'ring-amber-300/40',
      pulse: false,
    },
    Low: {
      bg: 'bg-emerald-600',
      border: 'border-emerald-200',
      ring: 'ring-emerald-300/40',
      pulse: false,
    },
  }[priority] || {
    bg: 'bg-sky-600',
    border: 'border-sky-200',
    ring: 'ring-sky-300/40',
    pulse: false,
  };

  return L.divIcon({
    className: 'custom-priority-marker',
    html: `
      <div class="relative flex items-center justify-center">
        ${
          config.pulse
            ? `<span class="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-rose-400 opacity-60"></span>`
            : ''
        }
        <div class="relative w-6 h-6 rounded-full ${config.bg} border-2 border-white shadow-md flex items-center justify-center text-white text-[10px] font-bold">
          ${priority[0]}
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
};

const iconHigh = createPriorityIcon('High');
const iconMedium = createPriorityIcon('Medium');
const iconLow = createPriorityIcon('Low');

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface HotspotMapProps {
  complaints: Complaint[];
  onSelectComplaint?: (complaint: Complaint) => void;
  focusedComplaint?: Complaint | null;
}

export const HotspotMap: React.FC<HotspotMapProps> = ({
  complaints,
  onSelectComplaint,
  focusedComplaint,
}) => {
  const [epsilon, setEpsilon] = useState<number>(600); // 600 meters
  const [minPts, setMinPts] = useState<number>(2); // 2 complaints
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    if (filterPriority === 'all') return complaints;
    return complaints.filter((c) => c.priority.toLowerCase() === filterPriority.toLowerCase());
  }, [complaints, filterPriority]);

  // Run DBSCAN spatial clustering
  const { clusters, noisePoints } = useMemo(() => {
    return runDBSCAN(filteredComplaints, epsilon, minPts);
  }, [filteredComplaints, epsilon, minPts]);

  // Default Map center: use focused complaint or first complaint or Anna Nagar, Chennai
  const mapCenter: [number, number] = useMemo(() => {
    if (focusedComplaint?.location) {
      return [focusedComplaint.location.latitude, focusedComplaint.location.longitude];
    }
    if (complaints.length > 0 && complaints[0].location) {
      return [complaints[0].location.latitude, complaints[0].location.longitude];
    }
    return [13.085, 80.2101];
  }, [focusedComplaint, complaints]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col space-y-4 p-4 sm:p-6">
      {/* Map Controls Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                Geospatial Hotspot Map (DBSCAN)
              </h3>
              <p className="text-xs text-slate-500">
                Detect high-density civic grievance clusters based on spatial density algorithm
              </p>
            </div>
          </div>
        </div>

        {/* DBSCAN Interactive Parameters Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Toggle Hotspot Circles */}
          <button
            type="button"
            onClick={() => setShowHotspots((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
              showHotspots
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Hotspot Layers: {showHotspots ? 'ON' : 'OFF'}</span>
          </button>

          {/* Epsilon (Neighborhood Distance) */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-400 font-medium">ε Radius:</span>
            <select
              value={epsilon}
              onChange={(e) => setEpsilon(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value={400}>400m</option>
              <option value={600}>600m</option>
              <option value={800}>800m</option>
              <option value={1200}>1.2km</option>
            </select>
          </div>

          {/* MinPts (Density threshold) */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-400 font-medium">MinPts:</span>
            <select
              value={minPts}
              onChange={(e) => setMinPts(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value={2}>≥ 2 complaints</option>
              <option value={3}>≥ 3 complaints</option>
              <option value={4}>≥ 4 complaints</option>
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-400 font-medium">Filter:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Badges Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Mapped</span>
          <span className="text-base font-extrabold text-slate-900">{filteredComplaints.length} Points</span>
        </div>

        <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200/80">
          <span className="text-rose-600 block text-[10px] font-bold uppercase">Hotspots Detected</span>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-extrabold text-rose-900">{clusters.length} Clusters</span>
            <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded-full">DBSCAN</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80">
          <span className="text-amber-600 block text-[10px] font-bold uppercase">Clustered Complaints</span>
          <span className="text-base font-extrabold text-amber-900">
            {clusters.reduce((sum, c) => sum + c.density, 0)} Complaints
          </span>
        </div>

        <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200/80">
          <span className="text-indigo-600 block text-[10px] font-bold uppercase">Isolated Issues</span>
          <span className="text-base font-extrabold text-indigo-900">{noisePoints.length} Noise Points</span>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-[480px] w-full shadow-inner">
        <MapContainer
          center={mapCenter}
          zoom={14}
          scrollWheelZoom={true}
          className="h-full w-full z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapRecenter center={mapCenter} />

          {/* Render DBSCAN Hotspot Circles */}
          {showHotspots &&
            clusters.map((cluster) => (
              <React.Fragment key={`cluster-${cluster.clusterId}`}>
                <Circle
                  center={[cluster.center.latitude, cluster.center.longitude]}
                  radius={cluster.radiusMeters}
                  pathOptions={{
                    color: cluster.highPriorityCount > 0 ? '#e11d48' : '#f59e0b',
                    fillColor: cluster.highPriorityCount > 0 ? '#f43f5e' : '#fbbf24',
                    fillOpacity: 0.22,
                    weight: 2,
                    dashArray: '4, 6',
                  }}
                >
                  <Popup>
                    <div className="p-2 text-xs space-y-1.5 min-w-[200px]">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900 border-b border-rose-100 pb-1">
                        <Flame className="w-4 h-4 text-rose-600" />
                        <span>DBSCAN Hotspot #{cluster.clusterId}</span>
                      </div>
                      <p className="text-slate-600">
                        Density: <strong className="text-slate-900">{cluster.density} complaints</strong> within{' '}
                        {cluster.radiusMeters}m radius
                      </p>
                      <p className="text-slate-600">
                        Dominant Category: <strong className="text-slate-900">{cluster.dominantCategory}</strong>
                      </p>
                      {cluster.highPriorityCount > 0 && (
                        <span className="inline-block text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                          ⚠️ {cluster.highPriorityCount} High Priority Grievance(s)
                        </span>
                      )}
                    </div>
                  </Popup>
                </Circle>
              </React.Fragment>
            ))}

          {/* Render Individual Complaint Markers */}
          {filteredComplaints.map((complaint) => {
            const icon =
              complaint.priority === 'High'
                ? iconHigh
                : complaint.priority === 'Medium'
                ? iconMedium
                : iconLow;

            return (
              <Marker
                key={complaint.id}
                position={[complaint.location.latitude, complaint.location.longitude]}
                icon={icon}
              >
                <Popup>
                  <div className="p-2 text-xs space-y-2 max-w-[220px]">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                      <span className="font-bold text-slate-900">{complaint.id}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          complaint.priority === 'High'
                            ? 'bg-rose-100 text-rose-800'
                            : complaint.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {complaint.priority}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-800">{complaint.category}</p>
                    <p className="text-slate-500 text-[11px] leading-tight truncate">
                      {complaint.location.address}
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      Status: <strong className="text-slate-700">{complaint.status}</strong>
                    </p>

                    {onSelectComplaint && (
                      <button
                        type="button"
                        onClick={() => onSelectComplaint(complaint)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Details</span>
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Legend */}
        <div className="absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-md text-xs space-y-2 max-w-xs">
          <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-sky-600" />
            <span>Map Legend</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-600"></span>
              <span className="text-slate-600">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-slate-600">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              <span className="text-slate-600">Low</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
            <span className="w-3 h-3 rounded-full border border-rose-500 bg-rose-200"></span>
            <span>DBSCAN Density Cluster Area</span>
          </div>
        </div>
      </div>
    </div>
  );
};
