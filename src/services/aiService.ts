import type {
  AIClassificationResult,
  DuplicateDetectionResult,
  PriorityPredictionResult,
  AIAnalysisResult,
  Complaint,
  ComplaintCategory,
  Department,
  LocationCoords,
  ChatMessage,
  AssistantResponse
} from '../types';
import { delay } from './api';

// Department mapping based on category
export const CATEGORY_DEPARTMENT_MAP: Record<ComplaintCategory, Department> = {
  Pothole: 'Road Maintenance Department',
  'Water Supply': 'Water & Sewerage Board',
  Drainage: 'Water & Sewerage Board',
  Streetlight: 'Electricity & Lighting Department',
  Garbage: 'Solid Waste Management',
  Traffic: 'Traffic & Transport Department',
  'Stray Animals': 'Public Health & Sanitation',
  'Tree Fall': 'Horticulture & Parks',
  'Illegal Construction': 'Town Planning & Enforcement',
  'Air & Noise': 'Public Health & Sanitation',
  Other: 'Public Health & Sanitation'
};

// Haversine distance formula in meters
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * 1. Voice-to-Text Transcription Service
 * Returns the exact speech transcript captured by the browser's Web Speech API.
 * The system preserves the citizen's exact spoken words without adding, assuming,
 * or modifying any details.
 *
 * Limitation note: The client-side Web Speech API recognizes speech according to
 * the selected language tag (e.g., 'en-IN' for English, 'ta-IN' for Tamil).
 * It relies on browser engine capabilities rather than a server-side Whisper model.
 */
export async function transcribeAudio(
  audioBlob: Blob | string,
  realTranscript?: string
): Promise<{ text: string; confidence: number; durationSeconds: number }> {
  await delay(400); // Small delay to show transcription spinner

  // If a real transcript was captured via the Web Speech API, use it directly.
  if (realTranscript && realTranscript.trim().length > 0) {
    return {
      text: realTranscript.trim(),
      confidence: 0.97,
      durationSeconds: typeof audioBlob === 'string' ? 6 : 8
    };
  }

  // Fallback: speech recognition was unavailable or returned nothing.
  return {
    text: '(Could not transcribe audio. Please type your complaint in the text field.)',
    confidence: 0,
    durationSeconds: typeof audioBlob === 'string' ? 6 : 8
  };
}

/**
 * 2. XLM-RoBERTa Complaint Classification Service Placeholder
 * Future API: POST /api/classify
 */
export async function classifyComplaint(
  text: string,
  _imageUrls?: string[]
): Promise<AIClassificationResult> {
  await delay(800); // Simulate model inference

  const lower = text.toLowerCase();

  let category: ComplaintCategory = 'Other';
  let confidence = 0.88;
  const keywords: string[] = [];

  if (
    lower.includes('pothole') ||
    lower.includes('road') ||
    lower.includes('asphalt') ||
    lower.includes('crater') ||
    lower.includes('tar') ||
    lower.includes('speed breaker')
  ) {
    category = 'Pothole';
    confidence = 0.96;
    keywords.push('road damage', 'pothole', 'surface depression', 'traffic hazard');
  } else if (
    lower.includes('sewage') ||
    lower.includes('drain') ||
    lower.includes('gutter') ||
    lower.includes('manhole') ||
    lower.includes('overflow') ||
    lower.includes('clog') ||
    lower.includes('foul')
  ) {
    category = 'Drainage';
    confidence = 0.93;
    keywords.push('sewage overflow', 'drainage blockage', 'sanitation', 'manhole');
  } else if (
    lower.includes('light') ||
    lower.includes('lamp') ||
    lower.includes('dark') ||
    lower.includes('electricity') ||
    lower.includes('wire') ||
    lower.includes('pole')
  ) {
    category = 'Streetlight';
    confidence = 0.95;
    keywords.push('public lighting', 'dark street', 'pole fixture', 'pedestrian safety');
  } else if (
    lower.includes('water') ||
    lower.includes('pipe') ||
    lower.includes('leak') ||
    lower.includes('drinking water') ||
    lower.includes('tap') ||
    lower.includes('contamination')
  ) {
    category = 'Water Supply';
    confidence = 0.91;
    keywords.push('water supply', 'pipe leakage', 'distribution loss', 'scarcity');
  } else if (
    lower.includes('garbage') ||
    lower.includes('waste') ||
    lower.includes('trash') ||
    lower.includes('bin') ||
    lower.includes('dump') ||
    lower.includes('plastic') ||
    lower.includes('debris')
  ) {
    category = 'Garbage';
    confidence = 0.94;
    keywords.push('solid waste', 'bin overflow', 'littering', 'civic cleanliness');
  } else if (
    lower.includes('traffic') ||
    lower.includes('signal') ||
    lower.includes('parking') ||
    lower.includes('jam') ||
    lower.includes('congestion') ||
    lower.includes('accident')
  ) {
    category = 'Traffic';
    confidence = 0.89;
    keywords.push('traffic management', 'signal glitch', 'congestion', 'road safety');
  } else if (
    lower.includes('dog') ||
    lower.includes('cattle') ||
    lower.includes('cow') ||
    lower.includes('animal') ||
    lower.includes('bite') ||
    lower.includes('stray')
  ) {
    category = 'Stray Animals';
    confidence = 0.92;
    keywords.push('stray animal control', 'public safety', 'animal welfare');
  } else if (
    lower.includes('tree') ||
    lower.includes('branch') ||
    lower.includes('fallen') ||
    lower.includes('park') ||
    lower.includes('greenery')
  ) {
    category = 'Tree Fall';
    confidence = 0.95;
    keywords.push('tree branch clearance', 'horticulture', 'storm debris');
  } else if (
    lower.includes('building') ||
    lower.includes('construction') ||
    lower.includes('encroachment') ||
    lower.includes('illegal')
  ) {
    category = 'Illegal Construction';
    confidence = 0.87;
    keywords.push('unauthorized construction', 'encroachment', 'zoning violation');
  }

  const department = CATEGORY_DEPARTMENT_MAP[category];

  return {
    category,
    confidence,
    department,
    suggestedKeywords: keywords,
    aiSummary: `AI classified as ${category} under ${department} with ${Math.round(confidence * 100)}% confidence based on contextual semantics.`
  };
}

/**
 * 3. SBERT Semantic Similarity + Haversine Distance Duplicate Detection
 * Future API: POST /api/check-duplicate
 */
export async function checkDuplicateComplaint(
  description: string,
  location: LocationCoords,
  existingComplaints: Complaint[]
): Promise<DuplicateDetectionResult> {
  await delay(700); // Simulate SBERT vector embeddings and spatial check

  const lower = description.toLowerCase();

  for (const existing of existingComplaints) {
    if (existing.status === 'Resolved' || existing.status === 'Rejected') continue;

    const distance = calculateHaversineDistance(
      location.latitude,
      location.longitude,
      existing.location.latitude,
      existing.location.longitude
    );

    if (distance <= 400) {
      const existingLower = existing.description.toLowerCase();
      const wordsA = new Set(lower.split(/\s+/).filter((w) => w.length > 3));
      const wordsB = new Set(existingLower.split(/\s+/).filter((w) => w.length > 3));
      let matchCount = 0;
      wordsA.forEach((w) => {
        if (wordsB.has(w)) matchCount++;
      });

      const similarityScore =
        Math.min(
          0.96,
          0.5 + (matchCount / Math.max(1, Math.min(wordsA.size, wordsB.size))) * 0.45
        );

      if (similarityScore > 0.65 || (distance < 120 && existing.category === 'Pothole' && lower.includes('pothole'))) {
        return {
          isDuplicate: true,
          similarComplaintId: existing.id,
          similarityScore: parseFloat(similarityScore.toFixed(2)),
          distanceMeters: distance,
          existingComplaint: existing,
          recommendation: `A similar active grievance (${existing.id}) was already reported ~${distance}m away. You can upvote/add your report or submit as a distinct complaint.`
        };
      }
    }
  }

  if (lower.includes('roundtana') || lower.includes('2nd avenue')) {
    const matched = existingComplaints.find((c) => c.id === 'CMP-2026-001245');
    if (matched && matched.status !== 'Resolved') {
      return {
        isDuplicate: true,
        similarComplaintId: matched.id,
        similarityScore: 0.91,
        distanceMeters: 45,
        existingComplaint: matched,
        recommendation: `High semantic and geographic overlap with active complaint ${matched.id}.`
      };
    }
  }

  return {
    isDuplicate: false,
    recommendation: 'No duplicate or similar active complaint found in this vicinity.'
  };
}

/**
 * 4. XGBoost Priority Prediction Model Placeholder
 * Future API: POST /api/predict-priority
 */
export async function predictPriority(
  category: ComplaintCategory,
  description: string,
  _location: LocationCoords,
  hasMedia = false
): Promise<PriorityPredictionResult> {
  await delay(600); // Simulate XGBoost tree inference

  const lower = description.toLowerCase();
  let score = 50;
  const factors: string[] = [];

  if (category === 'Drainage' || category === 'Water Supply') {
    score += 20;
    factors.push('Public Health & Water Infrastructure Criticality');
  } else if (category === 'Pothole' || category === 'Traffic') {
    score += 15;
    factors.push('Road Accident Vulnerability Index');
  } else if (category === 'Streetlight') {
    score += 10;
    factors.push('Public Safety in Low Visibility Zones');
  }

  if (
    lower.includes('danger') ||
    lower.includes('accident') ||
    lower.includes('hospital') ||
    lower.includes('school') ||
    lower.includes('emergency') ||
    lower.includes('senior') ||
    lower.includes('child') ||
    lower.includes('overflow') ||
    lower.includes('severe')
  ) {
    score += 25;
    factors.push('High Urgency / Safety Hazard Detected in Text');
  }

  if (hasMedia) {
    score += 5;
    factors.push('Visual/Audio Evidence Attached');
  }

  if (lower.includes('main road') || lower.includes('avenue') || lower.includes('bus stand') || lower.includes('junction')) {
    score += 15;
    factors.push('High Footfall Arterial Transit Corridor');
  }

  score = Math.min(98, Math.max(25, score));

  let priority: 'High' | 'Medium' | 'Low' = 'Low';
  if (score >= 75) {
    priority = 'High';
  } else if (score >= 50) {
    priority = 'Medium';
  }

  return {
    priority,
    score,
    factors
  };
}

export async function runFullAIAnalysis(
  description: string,
  location: LocationCoords,
  existingComplaints: Complaint[],
  imageUrls: string[] = [],
  _hasVoice = false
): Promise<AIAnalysisResult> {
  const startTime = Date.now();

  const [classification, duplicate] = await Promise.all([
    classifyComplaint(description, imageUrls),
    checkDuplicateComplaint(description, location, existingComplaints)
  ]);

  const priority = await predictPriority(
    classification.category,
    description,
    location,
    imageUrls.length > 0 || _hasVoice
  );

  return {
    classification,
    priority,
    duplicate,
    processingTimeMs: Date.now() - startTime
  };
}

/**
 * 5. Optional AI Complaint Assistant Chatbot Service
 */
export async function getAssistantResponse(
  chatHistory: ChatMessage[],
  userInput: string
): Promise<AssistantResponse> {
  await delay(600);

  const lower = userInput.toLowerCase();
  const stepCount = chatHistory.filter((m) => m.sender === 'user').length;

  if (stepCount === 0 || lower.includes('start') || lower.includes('help')) {
    return {
      message:
        'Hello! I am your Smart City AI Assistant 🤖. Tell me what civic problem you are facing in simple words (e.g. "There is water on the street", "Broken street lamp", "Garbage not picked up").',
      suggestedOptions: ['Pothole on road', 'Water on street', 'Streetlight not working', 'Garbage dumping']
    };
  }

  if (lower.includes('water') || lower.includes('leak') || lower.includes('flooding') || lower.includes('drain')) {
    if (lower.includes('pipe') || lower.includes('leakage') || lower.includes('clean')) {
      return {
        message:
          'Got it. Is the water pipe leakage near a water meter, beneath the road surface, or at an overhead connection?',
        suggestedOptions: ['Main Underground Pipe', 'Household Meter Valve', 'Overhead Line', 'Not Sure'],
        refinedDescription: 'Potable drinking water pipe leakage causing clean water wastage on public street.',
        detectedCategoryHint: 'Water Supply'
      };
    } else if (lower.includes('drainage') || lower.includes('sewage') || lower.includes('smell') || lower.includes('foul')) {
      return {
        message:
          'Understood. Is the sewage overflowing from an open manhole, a blocked stormwater drain, or a residential chamber?',
        suggestedOptions: ['Manhole Overflowing', 'Blocked Stormwater Drain', 'Choked Street Drain', 'Not Sure'],
        refinedDescription: 'Sewage drain blockage with foul-smelling wastewater overflowing onto the public walkway.',
        detectedCategoryHint: 'Drainage'
      };
    } else {
      return {
        message: 'Can you specify whether this water issue is caused by a drinking water pipe leakage, blocked sewage drainage, or rain accumulation?',
        suggestedOptions: ['Drinking Water Leakage', 'Blocked Drainage / Sewage', 'Rain / Flood Stagnation', 'Not Sure']
      };
    }
  }

  if (lower.includes('road') || lower.includes('pothole') || lower.includes('crack') || lower.includes('accident')) {
    return {
      message: 'Is the pothole causing vehicle damage or bike skidding risk? How deep or large is it approximately?',
      suggestedOptions: ['Large & Deep (> 1 foot)', 'Medium crater', 'Multiple small potholes', 'Damaged speed breaker'],
      refinedDescription: 'Dangerous road crater / pothole causing traffic slowdown and safety risk to two-wheelers.',
      detectedCategoryHint: 'Pothole'
    };
  }

  if (lower.includes('light') || lower.includes('dark') || lower.includes('lamp') || lower.includes('pole')) {
    return {
      message: 'Is a single streetlight non-functional, or is the entire street segment dark?',
      suggestedOptions: ['Single Pole Dark', 'Entire Street (Multiple Poles)', 'Flickering Bulb', 'Damaged Pole Wire'],
      refinedDescription: 'Public street lighting fixture non-operational, resulting in dark and unsafe conditions for pedestrians.',
      detectedCategoryHint: 'Streetlight'
    };
  }

  if (lower.includes('garbage') || lower.includes('waste') || lower.includes('bin') || lower.includes('trash')) {
    return {
      message: 'Is it an overflowing community bin, unauthorized open dumping on empty plot, or missed door-to-door collection?',
      suggestedOptions: ['Overflowing Public Bin', 'Open Illegal Dump Yard', 'Missed Door-to-Door Pickup', 'Animal Scattering Waste'],
      refinedDescription: 'Accumulated municipal solid waste and overflowing dustbin creating unhygienic conditions.',
      detectedCategoryHint: 'Garbage'
    };
  }

  return {
    message: `Thank you for sharing that. I have drafted a clear civic complaint for you: "${userInput}". Would you like to use this, or add more details such as nearby landmarks?`,
    suggestedOptions: ['Looks good! Use this description', 'Add Landmark details', 'Start over'],
    refinedDescription: userInput
  };
}
