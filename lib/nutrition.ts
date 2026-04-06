import type { UserProfile, UserProfileWithTargets, GoalType } from "@/types";

const ACTIVITY_MULTIPLIER = 1.55; // atividade moderada

const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  lose_weight: 0.85,
  maintain: 1.0,
  gain_muscle: 1.1,
};

// Splits de macros por objetivo: [proteína%, carbs%, gordura%]
const MACRO_SPLITS: Record<GoalType, [number, number, number]> = {
  lose_weight: [0.35, 0.35, 0.30],
  maintain:    [0.25, 0.50, 0.25],
  gain_muscle: [0.30, 0.45, 0.25],
};

export function computeTargets(profile: UserProfile): UserProfileWithTargets {
  const { weight_kg, height_cm, age, sex, goal } = profile;

  // Mifflin-St Jeor BMR
  const bmr =
    sex === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIER;
  const daily_calories = Math.round(tdee * GOAL_ADJUSTMENTS[goal]);

  const [protPct, carbsPct, fatPct] = MACRO_SPLITS[goal];

  return {
    ...profile,
    daily_calories,
    daily_protein: Math.round((daily_calories * protPct) / 4),
    daily_carbs:   Math.round((daily_calories * carbsPct) / 4),
    daily_fat:     Math.round((daily_calories * fatPct) / 9),
    daily_fiber:   28,
  };
}
