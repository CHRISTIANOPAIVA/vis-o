// types/index.ts
export type GoalType = "lose_weight" | "maintain" | "gain_muscle";
export type Sex = "male" | "female";

export interface UserProfile {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  goal: GoalType;
}

export interface UserProfileWithTargets extends UserProfile {
  daily_calories: number;
  daily_protein: number;
  daily_carbs: number;
  daily_fat: number;
  daily_fiber: number;
}

export interface DailyNutrition {
  date: string; // "YYYY-MM-DD"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}
export interface MacroNutrients {
  protein: number; // em gramas
  carbs: number;   // em gramas
  fat: number;     // em gramas
  fiber: number;   // em gramas
}

export interface NutritionAnalysis {
  food_name: string;
  calories: number;
  macros: MacroNutrients;
  confidence: "high" | "medium" | "low";
  explanation: string;
}

export interface Meal {
  id: number;
  created_at: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
  image_base64: string | null;
  is_edited: 0 | 1;
}
