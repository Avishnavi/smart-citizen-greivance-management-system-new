'use strict';

const MOCK_COMPLAINTS = [
  {
    complaintId: 'GRV-2025-101',
    citizenId: 'CIT-8842',
    description: 'Overflowing garbage bin near Ward 102 bus stop causing severe odor.',
    originalText: 'Overflowing garbage bin near Ward 102 bus stop causing severe odor.',
    language: 'English',
    inputType: 'text',
    hasVoice: false,
    imageUrls: ['https://images.unsplash.com/photo-1530587191325-3db32d826c18'],
    category: 'Public Health & Sanitation',
    priority: 'HIGH',
    priorityScore: 85,
    status: 'IN_PROGRESS',
    workflowStage: 'IN_PROGRESS',
    location: {
      latitude: 13.085,
      longitude: 80.2101,
      address: 'Anna Nagar West Bus Depot, Chennai',
      ward: 'Ward 102',
      zone: 'Zone 8'
    },
    routing: {
      departmentId: 'DEP-SAN',
      departmentName: 'Public Health & Sanitation'
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    complaintId: 'GRV-2025-102',
    citizenId: 'CIT-8842',
    description: 'Streetlights not working on 4th Main Road for the past 3 days.',
    originalText: 'Streetlights not working on 4th Main Road for the past 3 days.',
    language: 'English',
    inputType: 'text',
    hasVoice: true,
    category: 'Electrical & Street Lighting',
    priority: 'MEDIUM',
    priorityScore: 65,
    status: 'SUBMITTED',
    workflowStage: 'SUBMITTED',
    location: {
      latitude: 13.087,
      longitude: 80.213,
      address: '4th Main Road, Anna Nagar, Chennai',
      ward: 'Ward 102',
      zone: 'Zone 8'
    },
    routing: {
      departmentId: 'DEP-ELE',
      departmentName: 'Electrical & Street Lighting'
    },
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    complaintId: 'GRV-2025-103',
    citizenId: 'CIT-9120',
    description: 'Deep pothole on main road causing traffic delays and accident risk.',
    originalText: 'Deep pothole on main road causing traffic delays and accident risk.',
    language: 'English',
    inputType: 'text',
    category: 'Roads & Infrastructure',
    priority: 'CRITICAL',
    priorityScore: 92,
    status: 'RESOLVED',
    workflowStage: 'RESOLVED',
    location: {
      latitude: 13.082,
      longitude: 80.208,
      address: '2nd Avenue, Anna Nagar, Chennai',
      ward: 'Ward 101',
      zone: 'Zone 8'
    },
    routing: {
      departmentId: 'DEP-ROA',
      departmentName: 'Roads & Infrastructure'
    },
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

const MOCK_DEPARTMENTS = [
  { id: 'DEP-SAN', name: 'Public Health & Sanitation', code: 'SAN', active: true },
  { id: 'DEP-ELE', name: 'Electrical & Street Lighting', code: 'ELE', active: true },
  { id: 'DEP-ROA', name: 'Roads & Infrastructure', code: 'ROA', active: true },
  { id: 'DEP-WAT', name: 'Water Supply & Sewerage', code: 'WAT', active: true }
];

const MOCK_STATS = {
  totalComplaints: 28,
  pendingComplaints: 8,
  inProgressComplaints: 6,
  resolvedComplaints: 14,
  highPriorityComplaints: 4,
  resolutionRate: 50,
  recurringIssuesActive: 2,
  criticalEscalations: 1,
  categoryBreakdown: [
    { category: 'Public Health & Sanitation', count: 10 },
    { category: 'Electrical & Street Lighting', count: 7 },
    { category: 'Roads & Infrastructure', count: 6 },
    { category: 'Water Supply & Sewerage', count: 5 }
  ],
  wardBreakdown: [
    { ward: 'Ward 102', count: 12 },
    { ward: 'Ward 101', count: 9 },
    { ward: 'Ward 103', count: 7 }
  ]
};

module.exports = {
  MOCK_COMPLAINTS,
  MOCK_DEPARTMENTS,
  MOCK_STATS
};
