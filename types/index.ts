// types/index.ts
export interface MacroNutrients {
  protein: number; // em gramas
  carbs: number;   // em gramas
  fat: number;     // em gramas
}

export interface NutritionAnalysis {
  food_name: string;
  calories: number;
  macros: MacroNutrients;
  confidence: "high" | "medium" | "low";
  explanation: string; // Breve resumo do nutricionista IA
}