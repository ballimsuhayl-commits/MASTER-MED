
export type MedBlock = 'am' | 'pm' | 'cycle';

export interface Medication {
  id: number;
  n: string; // name
  d: string; // dosage
  block: MedBlock;
  status: 'pending' | 'taken' | 'skipped';
  time: string;
  schedule: string[];
  count: number;
}

export interface Injection {
  id: number;
  name: string;
  dosage: string;
  site: string; // e.g., "Left Abdomen"
  time: string;
  status: 'pending' | 'taken' | 'skipped';
  frequency: string;
  schedule: string[]; // Days of week for the reminder
}

export interface VaultItem {
  id: number;
  name: string;
  date: string;
  data: string;
  type: 'image' | 'pdf';
  mime?: string;
}

export interface DiaryEntry {
  id: number;
  text: string;
  tags: string[];
  quality: 'good' | 'neutral' | 'bad';
  time: string;
  date: string;
}

export interface Symptom {
  id: number;
  name: string;
  severity: number; // 1-10
  time: string;
  date: string;
  linkedMedId?: number;
}

export interface Stats {
  streak: number;
  level: number;
  xp: number;
  wellness: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export interface Pharmacy {
  name: string;
  phone: string;
  email: string;
}

export interface SafetyAnalysis {
  interactions: string[];
  correlations: string[];
  summary: string;
}

export interface FlareForecast {
  risk: 'Low' | 'Medium' | 'High';
  tip: string;
}

export interface DietPlan {
  preferredFoods: string[];
  meals: { name: string; desc: string }[];
  hydrationGoal: string;
}
