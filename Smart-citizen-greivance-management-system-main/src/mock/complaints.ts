import type { Complaint } from '../types';

export const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'CMP-2026-001245',
    userId: 'CIT-8842',
    description: 'Dangerous large pothole on 2nd Avenue near roundtana causing major traffic bottleneck and bike skidding risk.',
    category: 'Pothole',
    department: 'Road Maintenance Department',
    location: {
      latitude: 13.0850,
      longitude: 80.2101,
      address: '2nd Avenue, Near Anna Nagar Roundtana',
      ward: 'Ward 102',
      zone: 'Zone 8 (Anna Nagar)',
      landmark: 'Near Roundtana Bus Stand'
    },
    duplicateStatus: 'none',
    priority: 'High',
    priorityScore: 88,
    priorityFactors: ['High Traffic Corridor', 'Accident Hazard Risk', 'Monsoon Vulnerability'],
    status: 'In Progress',
    createdAt: '2026-08-30T10:15:00.000Z',
    updatedAt: '2026-08-31T14:30:00.000Z',
    imageUrls: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80'
    ],
    timeline: [
      {
        id: 't-1',
        step: 1,
        title: 'Complaint Submitted',
        description: 'Complaint received with geo-coordinates and road image.',
        timestamp: '2026-08-30T10:15:00.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-2',
        step: 2,
        title: 'AI Analysis Completed',
        description: 'Classified as Pothole (96% conf). Priority set to High due to arterial road safety index.',
        timestamp: '2026-08-30T10:15:15.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-3',
        step: 3,
        title: 'Assigned to Department',
        description: 'Forwarded to Assistant Executive Engineer, Ward 102.',
        timestamp: '2026-08-30T11:45:00.000Z',
        completed: true,
        current: false,
        officerName: 'Er. S. Selvam',
        department: 'Road Maintenance Department'
      },
      {
        id: 't-4',
        step: 4,
        title: 'In Progress - Inspection Done',
        description: 'Road inspection completed by field crew. Cold-mix asphalt patch scheduled for evening lull hours.',
        timestamp: '2026-08-31T14:30:00.000Z',
        completed: true,
        current: true,
        officerName: 'K. Vignesh (Field Supervisor)'
      },
      {
        id: 't-5',
        step: 5,
        title: 'Resolution & Quality Audit',
        description: 'Patching work completion and surface leveling verification.',
        timestamp: 'Pending',
        completed: false,
        current: false
      },
      {
        id: 't-6',
        step: 6,
        title: 'Citizen Feedback',
        description: 'Citizen satisfaction confirmation.',
        timestamp: 'Pending',
        completed: false,
        current: false
      }
    ]
  },
  {
    id: 'CMP-2026-001198',
    userId: 'CIT-8842',
    description: 'Streetlights malfunctioning on 4th Main Road for the past 3 consecutive nights. Total darkness on residential street.',
    category: 'Streetlight',
    department: 'Electricity & Lighting Department',
    location: {
      latitude: 13.0822,
      longitude: 80.2155,
      address: '4th Main Road, Shanti Colony, Anna Nagar',
      ward: 'Ward 101',
      zone: 'Zone 8 (Anna Nagar)',
      landmark: 'Opposite State Bank Branch'
    },
    duplicateStatus: 'none',
    priority: 'Medium',
    priorityScore: 62,
    priorityFactors: ['Pedestrian Safety', 'Public Lighting SLA Breached'],
    status: 'Resolved',
    createdAt: '2026-08-25T19:30:00.000Z',
    updatedAt: '2026-08-27T16:00:00.000Z',
    timeline: [
      {
        id: 't-21',
        step: 1,
        title: 'Complaint Submitted',
        description: 'Registered via Citizen Portal voice input.',
        timestamp: '2026-08-25T19:30:00.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-22',
        step: 2,
        title: 'AI Analysis Completed',
        description: 'Classified under Streetlight. Priority evaluated as Medium.',
        timestamp: '2026-08-25T19:30:10.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-23',
        step: 3,
        title: 'Assigned to Department',
        description: 'Sent to Electrical Maintenance Division - Zone 8.',
        timestamp: '2026-08-26T09:00:00.000Z',
        completed: true,
        current: false,
        officerName: 'R. Baskaran'
      },
      {
        id: 't-24',
        step: 4,
        title: 'In Progress',
        description: 'Feeder pillar MCB repaired and LED fixtures replaced by maintenance van.',
        timestamp: '2026-08-27T11:00:00.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-25',
        step: 5,
        title: 'Resolved',
        description: 'All 6 pole lights tested and operational. Night photometrics verified.',
        timestamp: '2026-08-27T16:00:00.000Z',
        completed: true,
        current: true
      },
      {
        id: 't-26',
        step: 6,
        title: 'Citizen Feedback',
        description: 'Citizen rated 5 stars for fast 48hr turnaround.',
        timestamp: '2026-08-28T09:15:00.000Z',
        completed: true,
        current: false
      }
    ],
    resolution: {
      resolvedAt: '2026-08-27T16:00:00.000Z',
      resolutionNotes: 'Repaired faulty phase contactor in junction pillar box and replaced two 90W LED units.',
      officerName: 'R. Baskaran (Divisional Engineer)',
      proofImageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80'
    },
    feedback: {
      rating: 5,
      comment: 'Prompt resolution within 48 hours! Street is well-lit now. Thank you Smart City team.',
      tags: ['Fast Resolution', 'Polite Staff', 'Excellent Work'],
      submittedAt: '2026-08-28T09:15:00.000Z'
    }
  },
  {
    id: 'CMP-2026-001024',
    userId: 'CIT-5521',
    description: 'Heavy overflow of sewage water from main drain manhole outside residential apartment complex.',
    category: 'Drainage',
    department: 'Water & Sewerage Board',
    location: {
      latitude: 13.0875,
      longitude: 80.2130,
      address: '12th Main Road, Anna Nagar West',
      ward: 'Ward 102',
      zone: 'Zone 8 (Anna Nagar)',
      landmark: 'Near Blue Star Junction'
    },
    duplicateStatus: 'none',
    priority: 'High',
    priorityScore: 92,
    priorityFactors: ['Health & Hygiene Hazard', 'Stagnant Contamination', 'Monsoon Risk'],
    status: 'In Progress',
    createdAt: '2026-08-29T08:00:00.000Z',
    updatedAt: '2026-08-30T11:00:00.000Z',
    imageUrls: [
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80'
    ],
    timeline: [
      {
        id: 't-31',
        step: 1,
        title: 'Complaint Submitted',
        description: 'Registered with photo and severity flag.',
        timestamp: '2026-08-29T08:00:00.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-32',
        step: 2,
        title: 'AI Analysis Completed',
        description: 'Category Drainage/Sewage confirmed. High priority health hazard detected.',
        timestamp: '2026-08-29T08:00:12.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-33',
        step: 3,
        title: 'Assigned to Department',
        description: 'Dispatched to Super Sucker & Jetting Machine Unit #4.',
        timestamp: '2026-08-29T09:30:00.000Z',
        completed: true,
        current: false,
        officerName: 'A. Sundarraj',
        department: 'Water & Sewerage Board'
      },
      {
        id: 't-34',
        step: 4,
        title: 'In Progress',
        description: 'Suction machine deployed. Silt de-clogging operation underway.',
        timestamp: '2026-08-30T11:00:00.000Z',
        completed: true,
        current: true,
        officerName: 'A. Sundarraj'
      },
      {
        id: 't-35',
        step: 5,
        title: 'Resolved',
        description: 'Line clearing and sanitization.',
        timestamp: 'Pending',
        completed: false,
        current: false
      },
      {
        id: 't-36',
        step: 6,
        title: 'Citizen Feedback',
        description: 'Post-resolution verification.',
        timestamp: 'Pending',
        completed: false,
        current: false
      }
    ]
  },
  {
    id: 'CMP-2026-000912',
    userId: 'CIT-8842',
    description: 'Commercial garbage bin overflowing with unsorted plastic and domestic waste. Odor spreading to nearby shops.',
    category: 'Garbage',
    department: 'Solid Waste Management',
    location: {
      latitude: 13.0418,
      longitude: 80.2341,
      address: 'Usman Road, T. Nagar',
      ward: 'Ward 134',
      zone: 'Zone 10 (T. Nagar)',
      landmark: 'Near Ranganathan Street Cross'
    },
    duplicateStatus: 'none',
    priority: 'Medium',
    priorityScore: 68,
    priorityFactors: ['High Footfall Commercial Zone', 'Sanitation Risk'],
    status: 'Resolved',
    createdAt: '2026-08-20T07:45:00.000Z',
    updatedAt: '2026-08-21T11:30:00.000Z',
    timeline: [
      {
        id: 't-41',
        step: 1,
        title: 'Complaint Submitted',
        description: 'Photo uploaded showing overflow.',
        timestamp: '2026-08-20T07:45:00.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-42',
        step: 2,
        title: 'AI Analysis Completed',
        description: 'Classified under Solid Waste Management. Medium Priority.',
        timestamp: '2026-08-20T07:45:10.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-43',
        step: 3,
        title: 'Assigned to Department',
        description: 'Compactor Vehicle Route #12 alerted.',
        timestamp: '2026-08-20T08:30:00.000Z',
        completed: true,
        current: false,
        officerName: 'M. Anand'
      },
      {
        id: 't-44',
        step: 4,
        title: 'In Progress',
        description: 'Waste cleared and bin sanitized.',
        timestamp: '2026-08-21T09:15:00.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-45',
        step: 5,
        title: 'Resolved',
        description: 'Bins emptied, secondary collection point disinfected with bleaching powder.',
        timestamp: '2026-08-21T11:30:00.000Z',
        completed: true,
        current: true
      },
      {
        id: 't-46',
        step: 6,
        title: 'Citizen Feedback',
        description: 'Rated 4 stars.',
        timestamp: '2026-08-22T10:00:00.000Z',
        completed: true,
        current: false
      }
    ],
    resolution: {
      resolvedAt: '2026-08-21T11:30:00.000Z',
      resolutionNotes: 'Cleared 1.4 tonnes of mixed waste with hydraulic compactor and treated area with disinfectant.',
      officerName: 'M. Anand (Sanitary Inspector)',
      proofImageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80'
    },
    feedback: {
      rating: 4,
      comment: 'Bin was cleared properly. Request to increase collection frequency in morning peak hours.',
      tags: ['Clean Work', 'Good Response'],
      submittedAt: '2026-08-22T10:00:00.000Z'
    }
  },
  {
    id: 'CMP-2026-000850',
    userId: 'CIT-8842',
    description: 'Drinking water pipe pipeline leaking at connection point causing thousands of liters of clean water wastage.',
    category: 'Water Supply',
    department: 'Water & Sewerage Board',
    location: {
      latitude: 13.0067,
      longitude: 80.2206,
      address: 'Gandhi Nagar 3rd Cross Street, Adyar',
      ward: 'Ward 173',
      zone: 'Zone 13 (Adyar)',
      landmark: 'Near Gandhi Nagar Club'
    },
    duplicateStatus: 'none',
    priority: 'Low',
    priorityScore: 45,
    priorityFactors: ['Water Conservation Resource Loss'],
    status: 'Pending',
    createdAt: '2026-08-31T17:00:00.000Z',
    updatedAt: '2026-08-31T17:00:00.000Z',
    timeline: [
      {
        id: 't-51',
        step: 1,
        title: 'Complaint Submitted',
        description: 'Registered with location coordinates and description.',
        timestamp: '2026-08-31T17:00:00.000Z',
        completed: true,
        current: true
      },
      {
        id: 't-52',
        step: 2,
        title: 'AI Analysis Completed',
        description: 'Classified as Water Supply. Priority Low/Normal.',
        timestamp: '2026-08-31T17:00:15.000Z',
        completed: true,
        current: false
      },
      {
        id: 't-53',
        step: 3,
        title: 'Assigned to Department',
        description: 'Pending queue allocation to Water Board Depot 173.',
        timestamp: 'Pending',
        completed: false,
        current: false
      },
      {
        id: 't-54',
        step: 4,
        title: 'In Progress',
        description: 'Plumbing crew pipeline valve check.',
        timestamp: 'Pending',
        completed: false,
        current: false
      },
      {
        id: 't-55',
        step: 5,
        title: 'Resolved',
        description: 'Pipe joint welding and pressure testing.',
        timestamp: 'Pending',
        completed: false,
        current: false
      },
      {
        id: 't-56',
        step: 6,
        title: 'Citizen Feedback',
        description: 'Citizen satisfaction confirmation.',
        timestamp: 'Pending',
        completed: false,
        current: false
      }
    ]
  }
];
