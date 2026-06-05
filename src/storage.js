// Local persistence for the food log.
//
// Data shape in localStorage under one key:
//   { "2026-06-05": { date, entries: [Entry, ...] }, ... }
//
// Entry = {
//   id, name, source: "scan"|"quick"|"manual", qty,
//   kcal, protein, carbs, fat,          // macros (already scaled to qty)
//   micros: { sugars, fiber, satFat, sodium, salt, ... },
//   additives: [{ code, name }],        // from Open Food Facts
//   nova,                               // 1..4 processing group, or null
//   time                                // ms timestamp for ordering
// }

const LOG_KEY = 'nt.log.v1'

// Local (not UTC) YYYY-MM-DD so "today" matches the user's clock.
export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey() {
  return dateKey()
}

function readLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY)) || {}
  } catch {
    return {}
  }
}

function writeLog(log) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log))
}

export function getDay(date = todayKey()) {
  const log = readLog()
  return log[date] || { date, entries: [] }
}

let idCounter = 0
function makeId() {
  // Time + counter avoids collisions within the same millisecond.
  return `${Date.now().toString(36)}-${(idCounter++).toString(36)}`
}

export function addEntry(entry, date = todayKey()) {
  const log = readLog()
  const day = log[date] || { date, entries: [] }
  const full = {
    id: makeId(),
    source: 'manual',
    qty: 1,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    micros: {},
    additives: [],
    nova: null,
    time: Date.now(),
    ...entry
  }
  day.entries.push(full)
  log[date] = day
  writeLog(log)
  return full
}

export function deleteEntry(id, date = todayKey()) {
  const log = readLog()
  const day = log[date]
  if (!day) return
  day.entries = day.entries.filter((e) => e.id !== id)
  log[date] = day
  writeLog(log)
}

const NUM = (v) => (typeof v === 'number' && isFinite(v) ? v : 0)

// Sum a day into macro totals, merged micros, and an additive tally.
export function dayTotals(date = todayKey()) {
  const day = getDay(date)
  const totals = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    micros: {},
    additiveCount: 0,
    additives: [], // [{ code, name, from }]
    novaWorst: 0
  }
  for (const e of day.entries) {
    totals.kcal += NUM(e.kcal)
    totals.protein += NUM(e.protein)
    totals.carbs += NUM(e.carbs)
    totals.fat += NUM(e.fat)
    for (const [k, v] of Object.entries(e.micros || {})) {
      totals.micros[k] = NUM(totals.micros[k]) + NUM(v)
    }
    for (const a of e.additives || []) {
      totals.additiveCount += 1
      totals.additives.push({ ...a, from: e.name })
    }
    if (e.nova && e.nova > totals.novaWorst) totals.novaWorst = e.nova
  }
  // Round macros for display sanity.
  totals.kcal = Math.round(totals.kcal)
  totals.protein = Math.round(totals.protein)
  totals.carbs = Math.round(totals.carbs)
  totals.fat = Math.round(totals.fat)
  return totals
}

// History: every day that has entries, newest first, with its totals.
export function listHistory() {
  const log = readLog()
  return Object.keys(log)
    .filter((d) => (log[d].entries || []).length > 0)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((d) => ({ date: d, totals: dayTotals(d), count: log[d].entries.length }))
}

export function clearAll() {
  localStorage.removeItem(LOG_KEY)
}
