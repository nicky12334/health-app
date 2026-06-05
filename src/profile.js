// Profile + daily goal calculation.
//
// Uses the Mifflin–St Jeor equation for BMR, scales by an activity factor to get
// TDEE (total daily energy expenditure), then adjusts for the weight goal. Macro
// targets are derived from the calorie goal with a sensible default split.

const PROFILE_KEY = 'nt.profile.v1'

export const ACTIVITY_FACTORS = {
  sedentary: { factor: 1.2, label: 'Sedentary (little/no exercise)' },
  light: { factor: 1.375, label: 'Light (1–3 days/week)' },
  moderate: { factor: 1.55, label: 'Moderate (3–5 days/week)' },
  very: { factor: 1.725, label: 'Very active (6–7 days/week)' },
  athlete: { factor: 1.9, label: 'Athlete (hard daily training)' }
}

export const GOALS = {
  lose: { delta: -500, label: 'Lose weight' },
  maintain: { delta: 0, label: 'Maintain weight' },
  gain: { delta: 400, label: 'Gain weight' }
}

const DEFAULT_PROFILE = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activity: 'moderate',
  goal: 'maintain'
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return null
  }
}

export function saveProfile(profile) {
  const clean = { ...DEFAULT_PROFILE, ...profile }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(clean))
  return clean
}

export function hasProfile() {
  return localStorage.getItem(PROFILE_KEY) !== null
}

// BMR via Mifflin–St Jeor.
export function calcBMR({ sex, age, heightCm, weightKg }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

// Full set of computed targets for a profile.
export function calcTargets(profile) {
  const p = { ...DEFAULT_PROFILE, ...(profile || {}) }
  const bmr = calcBMR(p)
  const factor = (ACTIVITY_FACTORS[p.activity] || ACTIVITY_FACTORS.moderate).factor
  const tdee = bmr * factor
  const delta = (GOALS[p.goal] || GOALS.maintain).delta

  // Never recommend below a conservative floor.
  const floor = p.sex === 'female' ? 1200 : 1500
  const calories = Math.max(floor, Math.round(tdee + delta))

  // Macro split: protein from bodyweight, fat at 25% of calories, carbs the rest.
  const proteinG = Math.round(1.8 * p.weightKg)
  const fatG = Math.round((calories * 0.25) / 9)
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG
  }
}
