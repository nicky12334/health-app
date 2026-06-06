// Open Food Facts lookup + parsing.
//
// Fetches a product by barcode and normalises it into per-100g macros, a fixed set
// of micronutrients (in known units), additives and the NOVA processing group.
// Scaling to an actual portion (grams) happens in scaleNutrition().

import { parseAdditives } from './additives.js'

const BASE = 'https://world.openfoodfacts.org/api/v2/product'
const SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl'

// Fields we request for both barcode lookup and search results.
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_front_small_url',
  'serving_quantity',
  'serving_size',
  'nutriments',
  'additives_tags',
  'nova_group'
].join(',')

// Our canonical micronutrients and the units we store them in.
// Each maps an Open Food Facts per-100g key + a factor to reach our unit.
export const MICRO_SPEC = {
  sugars: { off: 'sugars_100g', unit: 'g', factor: 1, label: 'Sugars' },
  fiber: { off: 'fiber_100g', unit: 'g', factor: 1, label: 'Fiber' },
  satFat: { off: 'saturated-fat_100g', unit: 'g', factor: 1, label: 'Saturated fat' },
  sodium: { off: 'sodium_100g', unit: 'mg', factor: 1000, label: 'Sodium' },
  salt: { off: 'salt_100g', unit: 'g', factor: 1, label: 'Salt' },
  vitaminC: { off: 'vitamin-c_100g', unit: 'mg', factor: 1000, label: 'Vitamin C' },
  calcium: { off: 'calcium_100g', unit: 'mg', factor: 1000, label: 'Calcium' },
  iron: { off: 'iron_100g', unit: 'mg', factor: 1000, label: 'Iron' },
  potassium: { off: 'potassium_100g', unit: 'mg', factor: 1000, label: 'Potassium' }
}

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && isFinite(n) ? n : 0
}

// Normalise a raw Open Food Facts product into our product shape.
function normalizeProduct(p, barcode) {
  const n = p.nutriments || {}
  const micros = {}
  for (const [key, spec] of Object.entries(MICRO_SPEC)) {
    if (n[spec.off] != null) micros[key] = num(n[spec.off]) * spec.factor
  }
  return {
    found: true,
    barcode: barcode || p.code || '',
    name: p.product_name?.trim() || `Item ${barcode || p.code || ''}`,
    brand: p.brands?.split(',')[0]?.trim() || '',
    imageUrl: p.image_front_small_url || '',
    servingG: num(p.serving_quantity) || null, // grams per serving, if known
    servingSize: p.serving_size || '',
    per100: {
      kcal: num(n['energy-kcal_100g']),
      protein: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g),
      micros
    },
    additives: parseAdditives(p.additives_tags || []),
    nova: p.nova_group ? Number(p.nova_group) : null
  }
}

// Fetch + normalise. Returns { found:false } when the barcode is unknown.
export async function lookupBarcode(barcode) {
  const res = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`)
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const data = await res.json()

  if (data.status !== 1 || !data.product) {
    return { found: false, barcode }
  }
  return normalizeProduct(data.product, barcode)
}

// Search foods by name (e.g. "egg", "shepherd's pie"). Returns normalised products,
// best-known first, dropping ones with no usable nutrition data.
export async function searchFoods(query, pageSize = 24) {
  const q = query.trim()
  if (!q) return []
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    sort_by: 'popularity_key',
    page_size: String(pageSize),
    fields: FIELDS
  })
  const res = await fetch(`${SEARCH}?${params.toString()}`)
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const data = await res.json()

  return (data.products || [])
    .map((p) => normalizeProduct(p))
    .filter(
      (p) =>
        p.name &&
        !p.name.startsWith('Item ') &&
        (p.per100.kcal > 0 || p.per100.protein > 0 || p.per100.carbs > 0 || p.per100.fat > 0)
    )
}

// Build a storable entry from a looked-up product + a portion in grams.
export function scaleNutrition(product, grams, source = 'scan') {
  const f = grams / 100
  const micros = {}
  for (const [k, v] of Object.entries(product.per100.micros)) {
    micros[k] = round(v * f)
  }
  return {
    name: product.brand ? `${product.name} (${product.brand})` : product.name,
    source,
    qty: grams,
    kcal: round(product.per100.kcal * f),
    protein: round(product.per100.protein * f),
    carbs: round(product.per100.carbs * f),
    fat: round(product.per100.fat * f),
    micros,
    additives: product.additives,
    nova: product.nova
  }
}

function round(n) {
  return Math.round(n * 10) / 10
}
