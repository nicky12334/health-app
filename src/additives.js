// Additive + processing-level handling.
//
// Open Food Facts returns additives as tags like "en:e330" and a NOVA processing
// group (1 = unprocessed ... 4 = ultra-processed). We turn the tags into readable
// {code, name} pairs using a small built-in table of common E-numbers, falling back
// to the bare code when unknown.

// A small, non-exhaustive table of commonly-seen additives.
const E_NAMES = {
  E100: 'Curcumin',
  E101: 'Riboflavin',
  E102: 'Tartrazine',
  E110: 'Sunset Yellow',
  E120: 'Cochineal',
  E122: 'Carmoisine',
  E124: 'Ponceau 4R',
  E129: 'Allura Red',
  E150A: 'Caramel colour',
  E150C: 'Ammonia caramel',
  E150D: 'Sulphite ammonia caramel',
  E160A: 'Carotenes',
  E160C: 'Paprika extract',
  E162: 'Beetroot red',
  E163: 'Anthocyanins',
  E170: 'Calcium carbonate',
  E171: 'Titanium dioxide',
  E202: 'Potassium sorbate',
  E211: 'Sodium benzoate',
  E220: 'Sulphur dioxide',
  E223: 'Sodium metabisulphite',
  E250: 'Sodium nitrite',
  E251: 'Sodium nitrate',
  E260: 'Acetic acid',
  E270: 'Lactic acid',
  E296: 'Malic acid',
  E300: 'Ascorbic acid (Vit C)',
  E301: 'Sodium ascorbate',
  E306: 'Tocopherols (Vit E)',
  E322: 'Lecithins',
  E330: 'Citric acid',
  E331: 'Sodium citrate',
  E338: 'Phosphoric acid',
  E341: 'Calcium phosphate',
  E407: 'Carrageenan',
  E412: 'Guar gum',
  E415: 'Xanthan gum',
  E420: 'Sorbitol',
  E421: 'Mannitol',
  E422: 'Glycerol',
  E440: 'Pectin',
  E450: 'Diphosphates',
  E451: 'Triphosphates',
  E460: 'Cellulose',
  E466: 'Carboxymethyl cellulose',
  E471: 'Mono- & diglycerides',
  E472E: 'DATEM',
  E481: 'Sodium stearoyl lactylate',
  E500: 'Sodium carbonates',
  E501: 'Potassium carbonates',
  E503: 'Ammonium carbonates',
  E504: 'Magnesium carbonates',
  E509: 'Calcium chloride',
  E551: 'Silicon dioxide',
  E575: 'Glucono delta-lactone',
  E621: 'Monosodium glutamate (MSG)',
  E627: 'Disodium guanylate',
  E631: 'Disodium inosinate',
  E901: 'Beeswax',
  E950: 'Acesulfame K',
  E951: 'Aspartame',
  E952: 'Cyclamate',
  E954: 'Saccharin',
  E955: 'Sucralose',
  E960: 'Steviol glycosides',
  E965: 'Maltitol',
  E967: 'Xylitol'
}

// "en:e330" / "e330" -> "E330"
function normaliseCode(tag) {
  const raw = String(tag).split(':').pop().trim().toUpperCase()
  return raw.startsWith('E') ? raw : raw
}

// Turn an array of OFF additive tags into [{ code, name }].
export function parseAdditives(tags = []) {
  const seen = new Set()
  const out = []
  for (const tag of tags) {
    const code = normaliseCode(tag)
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({ code, name: E_NAMES[code] || 'Additive' })
  }
  return out
}

const NOVA_LABELS = {
  1: 'Unprocessed / minimally processed',
  2: 'Processed culinary ingredient',
  3: 'Processed food',
  4: 'Ultra-processed'
}

export function novaLabel(group) {
  return NOVA_LABELS[group] || 'Unknown processing level'
}

export function novaClass(group) {
  if (group >= 4) return 'nova-bad'
  if (group === 3) return 'nova-warn'
  if (group >= 1) return 'nova-ok'
  return ''
}
