// Quick-add parser.
//
// Turns short free-text like "+20 protein", "+100 cal", "30 carbs 10g fat" into a
// log entry. Multiple amounts in one string are combined. When calories aren't given
// explicitly they're derived from the macros (4/4/9 kcal per gram).

const KEYWORDS = [
  { field: 'protein', re: /\b(protein|prot|p)\b/ },
  { field: 'carbs', re: /\b(carbs?|carbohydrates?)\b/ },
  { field: 'fat', re: /\b(fats?|f)\b/ },
  { field: 'kcal', re: /\b(cal|cals|calorie|calories|kcal|energy|c)\b/ }
]

const UNIT_LABEL = { protein: 'g protein', carbs: 'g carbs', fat: 'g fat', kcal: 'kcal' }

// Match: a number (optionally signed/decimal), an optional "g" unit (as in "30g"),
// then the descriptor word (protein / carbs / fat / cal / kcal / ...).
const TOKEN_RE = /([+-]?\d+(?:\.\d+)?)\s*g?\s*([a-zA-Z]+)/g

function classify(word) {
  const w = word.toLowerCase()
  for (const k of KEYWORDS) {
    if (k.re.test(w)) return k.field
  }
  return null
}

// Returns a storable entry, or null if nothing recognisable was found.
export function parseQuickAdd(text) {
  if (!text || !text.trim()) return null

  const acc = { protein: 0, carbs: 0, fat: 0, kcal: 0 }
  const parts = []
  let matched = false

  let m
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const value = parseFloat(m[1])
    const field = classify(m[2])
    if (field == null || !isFinite(value)) continue
    acc[field] += value
    parts.push(`${trimNum(value)} ${UNIT_LABEL[field]}`)
    matched = true
  }

  if (!matched) return null

  // Derive calories from macros if the user didn't state them.
  let kcal = acc.kcal
  if (kcal === 0) kcal = acc.protein * 4 + acc.carbs * 4 + acc.fat * 9

  return {
    name: `Quick: ${parts.join(', ')}`,
    source: 'quick',
    qty: 1,
    kcal: round(kcal),
    protein: round(acc.protein),
    carbs: round(acc.carbs),
    fat: round(acc.fat),
    micros: {},
    additives: [],
    nova: null
  }
}

function trimNum(n) {
  return Math.round(n * 10) / 10
}
function round(n) {
  return Math.round(n * 10) / 10
}
