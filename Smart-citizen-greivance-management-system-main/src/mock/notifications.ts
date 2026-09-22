import type { NotificationItem, CivicAlert } from '../types';

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    complaintId: 'CMP-2026-001245',
    title: 'Field Inspection In Progress',
    message: 'Complaint CMP-2026-001245 (Pothole at Anna Nagar) has been inspected. Patchwork scheduled for tonight.',
    timestamp: '2026-08-31T14:30:00.000Z',
    read: false,
    type: 'status_change'
  },
  {
    id: 'notif-2',
    complaintId: 'CMP-2026-001245',
    title: 'Officer Assigned',
    message: 'Complaint CMP-2026-001245 assigned to Er. S. Selvam (Road Maintenance Dept).',
    timestamp: '2026-08-30T11:45:00.000Z',
    read: false,
    type: 'assigned'
  },
  {
    id: 'notif-3',
    complaintId: 'CMP-2026-001198',
    title: 'Complaint Resolved ✅',
    message: 'Complaint CMP-2026-001198 (Streetlights at Shanti Colony) is resolved. Please share your feedback.',
    timestamp: '2026-08-27T16:00:00.000Z',
    read: true,
    type: 'resolved'
  },
  {
    id: 'notif-4',
    title: 'City Monsoon Preparedness Alert',
    message: 'Pre-monsoon storm water drain desilting drive is active in your zone. Report any localized water logging early.',
    timestamp: '2026-08-25T08:00:00.000Z',
    read: true,
    type: 'announcement'
  }
];

export const CIVIC_ALERTS: CivicAlert[] = [
  {
    id: 'alert-1',
    title: 'Pre-Monsoon De-silting Drive Active in Zone 8 & 10',
    severity: 'info',
    message: 'Stormwater drain clearing units are operating 24x7. Report blockages via the portal for priority clearing.',
    date: '31 Aug 2026',
    affectedZones: ['Zone 8 (Anna Nagar)', 'Zone 10 (T. Nagar)']
  },
  {
    id: 'alert-2',
    title: 'Planned Water Supply Maintenance on Sept 2nd',
    severity: 'warning',
    message: 'Pipeline interconnect work in Ward 102 from 09:00 AM to 04:00 PM. Alternate water tankers available.',
    date: '30 Aug 2026',
    affectedZones: ['Zone 8 (Anna Nagar)']
  }
];
