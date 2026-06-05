// Open Food Facts lookup + parsing.
//
// Fetches a product by barcode and normalises it into per-100g macros, a fixed set
// of micronutrients (in known units), additives and the NOVA processing group.
// Scaling to an actual portion (grams) happens in scaleNutrition().

import { parseAdditives } from './additives.js'

const BASE = 'https://world.openfoodfacts.org/api/v2/product'

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

// Fetch + normalise. Returns { found:false } when the barcode is unknown.
export async function lookupBarcode(barcode) {
  const fields = [
    'product_name',
    'brands',
    'image_front_small_url',
    'serving_quantity',
    'serving_size',
    'nutriments',
    'additives_tags',
    'nova_group'
  ].join(',')

  const res = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json?fields=${fields}`)
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const data = await res.json()

  if (data.status !== 1 || !data.product) {
    return { found: false, barcode }
  }

  const p = data.product
  const n = p.nutriments || {}

  const micros = {}
  for (const [key, spec] of Object.entries(MICRO_SPEC)) {
    if (n[spec.off] != null) micros[key] = num(n[spec.off]) * spec.factor
  }

  return {
    found: true,
    barcode,
    name: p.product_name?.trim() || `Item ${barcode}`,
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

// Build a storable entry from a looked-up product + a portion in grams.
export function scaleNutrition(product, grams) {
  const f = grams / 100
  const micros = {}
  for (const [k, v] of Object.entries(product.per100.micros)) {
    micros[k] = round(v * f)
  }
  return {
    name: product.brand ? `${product.name} (${product.brand})` : product.name,
    source: 'scan',
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
