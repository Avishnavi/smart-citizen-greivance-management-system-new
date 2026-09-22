'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');

const Department = require('../models/Department');
const Officer = require('../models/Officer');
const Citizen = require('../models/Citizen');
const Complaint = require('../models/Complaint');
const WorkflowEvent = require('../models/WorkflowEvent');
const Resolution = require('../models/Resolution');
const Escalation = require('../models/Escalation');
const RecurringIssue = require('../models/RecurringIssue');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const Notification = require('../models/Notification');

const DEPARTMENTS = [
  {
    name: 'Road Maintenance Department',
    code: 'RMD',
    description: 'Pothole repairs, asphalt resurfacing, arterial road quality audits, and pedestrian footpath maintenance.',
    categoryMappings: ['Pothole'],
    slaHours: 48,
    contactEmail: 'roads.support@smartcity.gov.in',
    contactPhone: '044-2561 9001',
    headOfficerName: 'Er. S. Selvam (Chief Engineer)',
  },
  {
    name: 'Water & Sewerage Board',
    code: 'WSB',
    description: 'Drinking water pipeline supply, sewage manhole clearing, stormwater drains, and contamination control.',
    categoryMappings: ['Water Supply', 'Drainage'],
    slaHours: 24,
    contactEmail: 'water.sewage@smartcity.gov.in',
    contactPhone: '044-4567 4567',
    headOfficerName: 'Er. A. Sundarraj (Superintending Engineer)',
  },
  {
    name: 'Electricity & Lighting Department',
    code: 'ELD',
    description: 'Streetlight maintenance, LED fixture replacements, feeder pillar repairs, and public illumination safety.',
    categoryMappings: ['Streetlight'],
    slaHours: 48,
    contactEmail: 'lighting@smartcity.gov.in',
    contactPhone: '1912',
    headOfficerName: 'Er. R. Baskaran (Divisional Engineer)',
  },
  {
    name: 'Solid Waste Management',
    code: 'SWM',
    description: 'Municipal waste collection, public dustbin clearance, debris removal, and community sanitation.',
    categoryMappings: ['Garbage'],
    slaHours: 24,
    contactEmail: 'cleanliness@smartcity.gov.in',
    contactPhone: '1913',
    headOfficerName: 'M. Anand (Chief Sanitation Officer)',
  },
  {
    name: 'Traffic & Transport Department',
    code: 'TTD',
    description: 'Traffic signal calibration, illegal parking bottlenecks, road signs, and junction decongestion.',
    categoryMappings: ['Traffic'],
    slaHours: 72,
    contactEmail: 'traffic.cell@smartcity.gov.in',
    contactPhone: '044-2345 2345',
    headOfficerName: 'P. Ravichandran (Traffic Coordinator)',
  },
  {
    name: 'Public Health & Sanitation',
    code: 'PHS',
    description: 'Stray dog sterilization/vaccination, mosquito fogging, public health sanitation, and noise compliance.',
    categoryMappings: ['Stray Animals', 'Air & Noise', 'Other'],
    slaHours: 72,
    contactEmail: 'health@smartcity.gov.in',
    contactPhone: '044-2561 9100',
    headOfficerName: 'Dr. K. Meenakshi (Health Officer)',
  },
  {
    name: 'Town Planning & Enforcement',
    code: 'TPE',
    description: 'Unauthorized construction enforcement, zoning violation notices, and public property encroachment clearance.',
    categoryMappings: ['Illegal Construction'],
    slaHours: 120,
    contactEmail: 'enforcement@smartcity.gov.in',
    contactPhone: '044-2561 9200',
    headOfficerName: 'V. Senthil Nathan (Enforcement Officer)',
  },
  {
    name: 'Horticulture & Parks',
    code: 'HP',
    description: 'Storm tree fall clearance, park maintenance, branch trimming, and urban greenery preservation.',
    categoryMappings: ['Tree Fall'],
    slaHours: 24,
    contactEmail: 'parks.trees@smartcity.gov.in',
    contactPhone: '044-2561 9300',
    headOfficerName: 'S. Jayakumar (Horticulture Superintendent)',
  },
];

async function seed(shouldExit = true) {
  console.log('\n🌱  Starting MongoDB Atlas Seed Script...');
  await connectDatabase();

  // Clean existing collections
  console.log('🧹  Cleaning existing demo collections...');
  await Promise.all([
    Department.deleteMany({}),
    Officer.deleteMany({}),
    Citizen.deleteMany({}),
    Complaint.deleteMany({}),
    WorkflowEvent.deleteMany({}),
    Resolution.deleteMany({}),
    Escalation.deleteMany({}),
    RecurringIssue.deleteMany({}),
    KnowledgeDocument.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // 1. Insert Departments
  console.log('🏢  Seeding Departments...');
  const createdDepts = await Department.insertMany(DEPARTMENTS);
  const deptMap = {};
  createdDepts.forEach((d) => { deptMap[d.name] = d; });

  // 2. Insert Officers
  console.log('👷  Seeding Field Officers...');
  const officersData = [
    {
      name: 'Er. S. Selvam',
      employeeId: 'OFF-1021',
      departmentId: deptMap['Road Maintenance Department']._id,
      departmentName: 'Road Maintenance Department',
      designation: 'Assistant Executive Engineer',
      email: 's.selvam@smartcity.gov.in',
      phone: '+91 98401 11021',
      assignedWards: ['Ward 101', 'Ward 102'],
      activeComplaintCount: 1,
    },
    {
      name: 'A. Sundarraj',
      employeeId: 'OFF-1022',
      departmentId: deptMap['Water & Sewerage Board']._id,
      departmentName: 'Water & Sewerage Board',
      designation: 'Field Operations Engineer',
      email: 'a.sundarraj@smartcity.gov.in',
      phone: '+91 98401 11022',
      assignedWards: ['Ward 102', 'Ward 103'],
      activeComplaintCount: 2,
    },
    {
      name: 'R. Baskaran',
      employeeId: 'OFF-1023',
      departmentId: deptMap['Electricity & Lighting Department']._id,
      departmentName: 'Electricity & Lighting Department',
      designation: 'Divisional Engineer (Lighting)',
      email: 'r.baskaran@smartcity.gov.in',
      phone: '+91 98401 11023',
      assignedWards: ['Ward 101', 'Ward 102'],
      activeComplaintCount: 0,
    },
    {
      name: 'M. Anand',
      employeeId: 'OFF-1024',
      departmentId: deptMap['Solid Waste Management']._id,
      departmentName: 'Solid Waste Management',
      designation: 'Sanitary Inspector',
      email: 'm.anand@smartcity.gov.in',
      phone: '+91 98401 11024',
      assignedWards: ['Ward 134', 'Ward 135'],
      activeComplaintCount: 0,
    },
  ];
  await Officer.insertMany(officersData);

  // 3. Insert Demo Citizen
  console.log('👤  Seeding Citizen Profile...');
  const citizen = await Citizen.create({
    citizenId: 'CIT-8842',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar88@example.gov.in',
    phone: '+91 98401 23456',
    address: 'No. 42, 3rd Main Road, Anna Nagar West',
    ward: 'Ward 102',
    zone: 'Zone 8 (Anna Nagar)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    preferredLanguage: 'English',
    notificationPreferences: { sms: true, email: true, whatsapp: true, push: true },
    totalComplaints: 4,
  });

  // 4. Insert Knowledge Base Documents (for RAG)
  console.log('📚  Seeding Knowledge Documents (RAG)...');
  await KnowledgeDocument.insertMany([
    {
      title: 'Pothole Cold-Mix Resurfacing SOP v2.4',
      department: 'Road Maintenance Department',
      content: 'Standard operating procedure for pothole filling on arterial corridors. Requires edge cutting, debris cleaning, bitumen emulsion tack coat, cold-mix asphalt compaction up to road grade level, and photographic audit verification.',
      applicableCategories: ['Pothole'],
      documentType: 'resolution_standard',
    },
    {
      title: 'Municipal Streetlight SLA & Contactor Repair Guidelines',
      department: 'Electricity & Lighting Department',
      content: 'Feeder pillar contactor tripping, MCB burnt-out replacement, and 90W LED fixture replacement. Night photometrics test required before closing ticket. SLA 48 hours for arterial, 72 hours for residential streets.',
      applicableCategories: ['Streetlight'],
      documentType: 'sla_policy',
    },
    {
      title: 'Underground Sewer Manhole Clearing & Jetting Protocol',
      department: 'Water & Sewerage Board',
      content: 'Super sucker machine deployment procedure for main line desilting. Safety protocol prohibits manual entry without breathing apparatus. Mandatory sanitization with sodium hypochlorite after de-clogging.',
      applicableCategories: ['Drainage'],
      documentType: 'procedure',
    },
  ]);

  // 5. Insert Realistic Demo Complaints
  console.log('📝  Seeding Initial Complaints & Workflow Events...');

  // Complaint 1: Pothole (In Progress)
  const cmp1 = await Complaint.create({
    complaintId: 'CMP-2026-001245',
    citizenId: citizen.citizenId,
    originalText: 'Dangerous large pothole on 2nd Avenue near roundtana causing major traffic bottleneck and bike skidding risk.',
    description: 'Dangerous large pothole on 2nd Avenue near roundtana causing major traffic bottleneck and bike skidding risk.',
    category: 'Pothole',
    priority: 'HIGH',
    priorityScore: 88,
    priorityFactors: ['High Traffic Corridor', 'Accident Hazard Risk', 'Monsoon Vulnerability'],
    location: {
      latitude: 13.085,
      longitude: 80.2101,
      address: '2nd Avenue, Near Anna Nagar Roundtana',
      ward: 'Ward 102',
      zone: 'Zone 8 (Anna Nagar)',
      landmark: 'Near Roundtana Bus Stand',
    },
    status: 'IN_PROGRESS',
    workflowStage: 'IN_PROGRESS',
    routing: {
      departmentId: deptMap['Road Maintenance Department']._id,
      departmentName: 'Road Maintenance Department',
      assignedOfficerName: 'Er. S. Selvam',
      routingReason: 'Auto-routed based on category "Pothole".',
      routedAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
    imageUrls: ['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80'],
  });

  await WorkflowEvent.insertMany([
    {
      complaintId: cmp1.complaintId,
      eventType: 'COMPLAINT_SUBMITTED',
      description: 'Complaint received with geo-coordinates and road image.',
      actor: { type: 'citizen', name: 'Rajesh Kumar' },
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
    {
      complaintId: cmp1.complaintId,
      eventType: 'CATEGORY_ASSIGNED',
      description: 'Classified as Pothole (96% conf). Priority evaluated as HIGH.',
      actor: { type: 'system', name: 'AI Pipeline' },
      createdAt: new Date(Date.now() - 24 * 3600 * 1000 + 15000),
    },
    {
      complaintId: cmp1.complaintId,
      eventType: 'DEPARTMENT_ROUTED',
      description: 'Forwarded to Assistant Executive Engineer, Ward 102 (Er. S. Selvam).',
      actor: { type: 'system', name: 'Routing Engine' },
      createdAt: new Date(Date.now() - 20 * 3600 * 1000),
    },
    {
      complaintId: cmp1.complaintId,
      eventType: 'STATUS_CHANGED',
      description: 'Road inspection completed by field crew. Cold-mix asphalt patch scheduled.',
      actor: { type: 'officer', name: 'Er. S. Selvam' },
      createdAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
  ]);

  // Complaint 2: Streetlight (Resolved with feedback)
  const cmp2 = await Complaint.create({
    complaintId: 'CMP-2026-001198',
    citizenId: citizen.citizenId,
    originalText: 'Streetlights malfunctioning on 4th Main Road for the past 3 consecutive nights. Total darkness on residential street.',
    description: 'Streetlights malfunctioning on 4th Main Road for the past 3 consecutive nights. Total darkness on residential street.',
    category: 'Streetlight',
    priority: 'MEDIUM',
    priorityScore: 62,
    priorityFactors: ['Pedestrian Safety', 'Public Lighting SLA Breached'],
    location: {
      latitude: 13.0822,
      longitude: 80.2155,
      address: '4th Main Road, Shanti Colony, Anna Nagar',
      ward: 'Ward 101',
      zone: 'Zone 8 (Anna Nagar)',
      landmark: 'Opposite State Bank Branch',
    },
    status: 'CLOSED',
    workflowStage: 'CLOSED',
    routing: {
      departmentId: deptMap['Electricity & Lighting Department']._id,
      departmentName: 'Electricity & Lighting Department',
      assignedOfficerName: 'R. Baskaran',
      routingReason: 'Auto-routed based on category "Streetlight".',
    },
    feedback: {
      rating: 5,
      comment: 'Prompt resolution within 48 hours! Street is well-lit now. Thank you Smart City team.',
      tags: ['Fast Resolution', 'Polite Staff', 'Excellent Work'],
      submittedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    },
  });

  const res2 = await Resolution.create({
    complaintId: cmp2.complaintId,
    officerName: 'R. Baskaran (Divisional Engineer)',
    departmentName: 'Electricity & Lighting Department',
    resolutionNotes: 'Repaired faulty phase contactor in junction pillar box and replaced two 90W LED units. Night illumination tested.',
    verificationStatus: 'verified',
    verificationScore: 0.95,
    verificationReason: 'Resolution verified: action verbs detected and equipment replacement confirmed against SLA standards.',
    verifierType: 'ai',
    verifiedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
  });

  cmp2.resolutionId = res2._id;
  await cmp2.save();

  // Complaint 3: Drainage (Under Verification)
  const cmp3 = await Complaint.create({
    complaintId: 'CMP-2026-001024',
    citizenId: 'CIT-5521',
    originalText: 'Heavy overflow of sewage water from main drain manhole outside residential apartment complex.',
    description: 'Heavy overflow of sewage water from main drain manhole outside residential apartment complex.',
    category: 'Drainage',
    priority: 'HIGH',
    priorityScore: 92,
    priorityFactors: ['Health & Hygiene Hazard', 'Stagnant Contamination', 'Monsoon Risk'],
    location: {
      latitude: 13.0875,
      longitude: 80.213,
      address: '12th Main Road, Anna Nagar West',
      ward: 'Ward 102',
      zone: 'Zone 8 (Anna Nagar)',
      landmark: 'Near Blue Star Junction',
    },
    status: 'IN_PROGRESS',
    workflowStage: 'IN_PROGRESS',
    routing: {
      departmentId: deptMap['Water & Sewerage Board']._id,
      departmentName: 'Water & Sewerage Board',
      assignedOfficerName: 'A. Sundarraj',
      routingReason: 'Auto-routed based on category "Drainage".',
    },
    imageUrls: ['https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80'],
  });

  // Complaint 4: Garbage (Resolved)
  await Complaint.create({
    complaintId: 'CMP-2026-000912',
    citizenId: citizen.citizenId,
    originalText: 'Commercial garbage bin overflowing with unsorted plastic and domestic waste. Odor spreading to nearby shops.',
    description: 'Commercial garbage bin overflowing with unsorted plastic and domestic waste. Odor spreading to nearby shops.',
    category: 'Garbage',
    priority: 'MEDIUM',
    priorityScore: 68,
    priorityFactors: ['High Footfall Commercial Zone', 'Sanitation Risk'],
    location: {
      latitude: 13.0418,
      longitude: 80.2341,
      address: 'Usman Road, T. Nagar',
      ward: 'Ward 134',
      zone: 'Zone 10 (T. Nagar)',
      landmark: 'Near Ranganathan Street Cross',
    },
    status: 'CLOSED',
    workflowStage: 'CLOSED',
    routing: {
      departmentId: deptMap['Solid Waste Management']._id,
      departmentName: 'Solid Waste Management',
      assignedOfficerName: 'M. Anand',
      routingReason: 'Auto-routed based on category "Garbage".',
    },
    feedback: {
      rating: 4,
      comment: 'Bin was cleared properly. Request to increase collection frequency in morning peak hours.',
      tags: ['Clean Work', 'Good Response'],
      submittedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
    },
  });

  // Complaint 5: Water Supply (Pending)
  await Complaint.create({
    complaintId: 'CMP-2026-000850',
    citizenId: citizen.citizenId,
    originalText: 'Drinking water pipe pipeline leaking at connection point causing thousands of liters of clean water wastage.',
    description: 'Drinking water pipe pipeline leaking at connection point causing thousands of liters of clean water wastage.',
    category: 'Water Supply',
    priority: 'LOW',
    priorityScore: 45,
    priorityFactors: ['Water Conservation Resource Loss'],
    location: {
      latitude: 13.0067,
      longitude: 80.2206,
      address: 'Gandhi Nagar 3rd Cross Street, Adyar',
      ward: 'Ward 173',
      zone: 'Zone 13 (Adyar)',
      landmark: 'Near Gandhi Nagar Club',
    },
    status: 'SUBMITTED',
    workflowStage: 'SUBMITTED',
  });

  // 6. Insert Recurring Issue Cluster (Research demo)
  console.log('🔄  Seeding Recurring Issue Cluster...');
  await RecurringIssue.create({
    category: 'Pothole',
    ward: 'Ward 102',
    zone: 'Zone 8 (Anna Nagar)',
    centerLatitude: 13.085,
    centerLongitude: 80.2101,
    radiusMeters: 500,
    complaintIds: [cmp1.complaintId],
    occurrenceCount: 4,
    firstReportedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    lastReportedAt: new Date(),
    patternDescription: '4 road depression/pothole complaints reported within 500m radius in Ward 102 near Anna Nagar Roundtana over the last 30 days. Base layer failure suspected.',
    severity: 'HIGH',
    status: 'active',
  });

  // 7. Insert Notifications
  console.log('🔔  Seeding Notifications...');
  await Notification.insertMany([
    {
      citizenId: citizen.citizenId,
      complaintId: cmp1.complaintId,
      title: `Field Inspection Completed: ${cmp1.complaintId}`,
      message: 'Road maintenance crew has completed on-site inspection. Cold-mix patch scheduled.',
      type: 'status_change',
      read: false,
    },
    {
      citizenId: citizen.citizenId,
      complaintId: cmp2.complaintId,
      title: `Complaint Resolved: ${cmp2.complaintId}`,
      message: 'Streetlights on 4th Main Road have been repaired and verified.',
      type: 'resolved',
      read: true,
      readAt: new Date(),
    },
  ]);

  console.log('✅  MongoDB Database Seed Completed Successfully!\n');
  if (shouldExit) {
    process.exit(0);
  }
}

if (require.main === module) {
  seed(true).catch((err) => {
    console.error('❌  Seed script error:', err);
    process.exit(1);
  });
}

module.exports = { seed };
