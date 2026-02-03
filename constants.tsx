
import React from 'react';
import { 
  Apple, Utensils, Sparkles, Zap, BedDouble, Activity 
} from 'lucide-react';

export const VIVID_THEME = {
  mint: "bg-[#E0F2F1] border-[#B2DFDB] text-[#004D40]",
  teal: "bg-[#26A69A] border-[#00695C] text-[#FFFFFF]",
  panda: "bg-[#FFFFFF] border-[#E0E0E0] text-[#212121]",
  yellow: "bg-[#FFF9C4] border-[#FFF176] text-[#F57F17]",
  blue: "bg-[#E1F5FE] border-[#B3E5FC] text-[#01579B]",
  red: "bg-[#FFEBEE] border-[#FFCDD2] text-[#B71C1C]",
  black: "bg-[#000000] border-[#333333] text-[#FFFFFF]",
  green: "bg-[#E8F5E9] border-[#A5D6A7] text-[#1B5E20]",
  purple: "bg-[#F3E5F5] border-[#E1BEE7] text-[#4A148C]",
  sos: "bg-red-50 border-red-200 text-red-700"
};

export const LIFESTYLE_TAGS = [
  { label: "Healthy Food", icon: Apple, color: "bg-green-100 text-green-700" },
  { label: "Fast Food", icon: Utensils, color: "bg-orange-100 text-orange-700" },
  { label: "High Sugar", icon: Sparkles, color: "bg-pink-100 text-pink-700" },
  { label: "Exercise", icon: Zap, color: "bg-blue-100 text-blue-700" },
  { label: "Good Sleep", icon: BedDouble, color: "bg-indigo-100 text-indigo-700" },
  { label: "Stress", icon: Activity, color: "bg-red-100 text-red-700" }
];

export const QUADRANTS = ['UL', 'UR', 'LL', 'LR'];
export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
