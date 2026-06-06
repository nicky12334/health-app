// Screen rendering. Pure-ish view layer: each renderer rebuilds its container and
// wires events back through an `api` object provided by main.js
// (api = { refresh, navigate, addQuickAdd, deleteEntry, saveProfile, lookup, addProduct }).

import { todayKey, dateKey, getDay, dayTotals, listHistory, recentFoods } from './storage.js'
import {
  loadProfile,
  calcTargets,
  ACTIVITY_FACTORS,
  GOALS
} from './profile.js'
import { MICRO_SPEC } from './nutrition.js'
import { novaLabel, novaClass } from './additives.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10))

// ---- shared widgets --------------------------------------------------------

function progressBar(label, value, target, unit) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target > 0 && value > target
  return `
    <div class="bar-row">
      <div class="bar-head">
        <span>${esc(label)}</span>
        <span class="bar-val ${over ? 'over' : ''}">${fmt(value)} / ${fmt(target)} ${unit}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
      </div>
    </div>`
}

// Compact color-coded macro bar used inside the Today hero.
function macroStat(label, value, target, cls) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target > 0 && value > target
  return `
    <div class="macro-stat">
      <div class="macro-top">
        <span class="macro-name">${esc(label)}</span>
        <span class="macro-val ${over ? 'over' : ''}">${fmt(value)}<i>/${fmt(target)}g</i></span>
      </div>
      <div class="bar-track mini">
        <div class="bar-fill ${cls} ${over ? 'over' : ''}" style="width:${pct}%"></div>
      </div>
    </div>`
}

function niceDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (key === todayKey()) return 'Today'
  if (key === dateKey(new Date(Date.now() - 86400000))) return 'Yesterday'
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// ---- Today -----------------------------------------------------------------

export function renderToday(el, api) {
  const profile = loadProfile()
  const targets = profile ? calcTargets(profile) : null
  const date = todayKey()
  const day = getDay(date)
  const totals = dayTotals(date)

  // Calorie ring: r=52 in a 120 viewBox → circumference ≈ 326.726.
  const RING_C = 326.726
  let goalBanner
  if (targets) {
    const goal = targets.calories
    const pct = goal > 0 ? Math.min(1, totals.kcal / goal) : 0
    const over = totals.kcal > goal
    const dashOffset = RING_C * (1 - pct)
    const remaining = Math.round(goal - totals.kcal)
    const ringNum = over ? `+${Math.abs(remaining)}` : remaining
    const ringLabel = over ? 'over' : 'kcal left'

    goalBanner = `
      <section class="card hero">
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="ring-fill ${over ? 'over' : ''}" cx="60" cy="60" r="52"
              stroke-dasharray="${RING_C}" stroke-dashoffset="${dashOffset}"></circle>
          </svg>
          <div class="ring-center">
            <b>${ringNum}</b><span>${ringLabel}</span>
          </div>
        </div>
        <div class="hero-side">
          <p class="hero-eaten"><b>${fmt(totals.kcal)}</b> of ${fmt(goal)} kcal eaten</p>
          ${macroStat('Protein', totals.protein, targets.protein, 'p')}
          ${macroStat('Carbs', totals.carbs, targets.carbs, 'c')}
          ${macroStat('Fat', totals.fat, targets.fat, 'f')}
        </div>
      </section>`
  } else {
    goalBanner = `
      <section class="card prompt">
        <p>Set up your profile to get a daily calorie &amp; macro goal.</p>
        <button class="btn" id="go-profile">Set up profile</button>
      </section>`
  }

  const microKeys = Object.keys(totals.micros)
  const microSection = microKeys.length
    ? `
      <section class="card">
        <h2>Micronutrients</h2>
        <div class="micro-grid">
          ${microKeys
            .map((k) => {
              const spec = MICRO_SPEC[k]
              if (!spec) return ''
              return `<div class="micro"><span>${esc(spec.label)}</span><b>${fmt(
                totals.micros[k]
              )} ${spec.unit}</b></div>`
            })
            .join('')}
        </div>
      </section>`
    : ''

  const additiveSection = `
    <section class="card">
      <div class="add-head">
        <h2>Additives today</h2>
        <span class="badge ${totals.additiveCount ? 'badge-warn' : 'badge-ok'}">${
    totals.additiveCount
  }</span>
      </div>
      ${
        totals.novaWorst
          ? `<p class="nova ${novaClass(totals.novaWorst)}">Most processed today: NOVA ${
              totals.novaWorst
            } — ${esc(novaLabel(totals.novaWorst))}</p>`
          : ''
      }
      ${
        totals.additives.length
          ? `<ul class="additive-list">${totals.additives
              .map(
                (a) =>
                  `<li><b>${esc(a.code)}</b> ${esc(a.name)} <span class="from">${esc(
                    a.from
                  )}</span></li>`
              )
              .join('')}</ul>`
          : `<p class="muted">No additives logged yet.</p>`
      }
    </section>`

  const entries = day.entries
    .slice()
    .sort((a, b) => b.time - a.time)
    .map(
      (e) => `
      <li class="entry">
        <div class="entry-main">
          <span class="entry-name">${esc(e.name)}</span>
          <span class="entry-macros">${fmt(e.kcal)} kcal · P${fmt(e.protein)} C${fmt(
        e.carbs
      )} F${fmt(e.fat)}</span>
        </div>
        <button class="del" data-id="${esc(e.id)}" aria-label="Delete">✕</button>
      </li>`
    )
    .join('')

  el.innerHTML = `
    <header class="screen-head">
      <div><p class="eyebrow">${niceDate(date)}</p><h1>Today</h1></div>
    </header>
    ${goalBanner}

    <section class="card">
      <h2>Quick add</h2>
      <form id="quick-form" class="quick">
        <input id="quick-input" type="text" inputmode="text" autocomplete="off"
               placeholder="e.g. +20 protein  +100 cal" />
        <button class="btn" type="submit">Add</button>
      </form>
      <p class="hint">Type amounts like <code>+20 protein</code>, <code>+100 cal</code>, <code>30g carbs</code>.</p>
    </section>

    ${microSection}
    ${additiveSection}

    <section class="card">
      <h2>Logged foods</h2>
      ${entries ? `<ul class="entries">${entries}</ul>` : `<p class="muted">Nothing logged yet today.</p>`}
    </section>`

  // events
  el.querySelector('#go-profile')?.addEventListener('click', () => api.navigate('profile'))

  const form = el.querySelector('#quick-form')
  const input = el.querySelector('#quick-input')
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    const ok = api.addQuickAdd(input.value)
    if (!ok) {
      input.classList.add('err')
      setTimeout(() => input.classList.remove('err'), 600)
      return
    }
    api.refresh()
  })

  el.querySelectorAll('.del').forEach((btn) =>
    btn.addEventListener('click', () => {
      api.deleteEntry(btn.dataset.id)
      api.refresh()
    })
  )
}

// ---- Scan ------------------------------------------------------------------

export function renderScanScaffold(el) {
  el.innerHTML = `
    <header class="screen-head"><h1>Scan</h1></header>
    <section class="card scan-card">
      <div class="video-wrap">
        <video id="scan-video" playsinline muted></video>
        <div class="scan-frame"></div>
      </div>
      <p id="scan-status" class="muted">Point the camera at a barcode…</p>
    </section>
    <section id="scan-result"></section>`
  return {
    videoEl: el.querySelector('#scan-video'),
    statusEl: el.querySelector('#scan-status'),
    resultEl: el.querySelector('#scan-result')
  }
}

// Render a looked-up product with a portion input + add button.
// `source` tags how it was found ("scan" | "search") on the stored entry.
export function renderScanResult(resultEl, product, api, source = 'scan') {
  if (!product.found) {
    resultEl.innerHTML = `
      <section class="card">
        <h2>Not in database</h2>
        <p class="muted">Barcode <code>${esc(product.barcode)}</code> wasn't found.
        Use Quick add on the Today screen, or try another product.</p>
      </section>`
    return
  }

  const defaultG = product.servingG || 100
  resultEl.innerHTML = `
    <section class="card">
      <div class="prod-head">
        ${product.imageUrl ? `<img src="${esc(product.imageUrl)}" alt="" class="prod-img"/>` : ''}
        <div>
          <h2>${esc(product.name)}</h2>
          ${product.brand ? `<p class="muted">${esc(product.brand)}</p>` : ''}
        </div>
      </div>

      <div class="per100">
        per 100${'g'}: ${fmt(product.per100.kcal)} kcal · P${fmt(product.per100.protein)}
        C${fmt(product.per100.carbs)} F${fmt(product.per100.fat)}
      </div>

      ${
        product.nova
          ? `<p class="nova ${novaClass(product.nova)}">NOVA ${product.nova} — ${esc(
              novaLabel(product.nova)
            )}</p>`
          : ''
      }
      ${
        product.additives.length
          ? `<p class="muted">Additives: ${product.additives
              .map((a) => `${esc(a.code)}`)
              .join(', ')}</p>`
          : ''
      }

      <form id="portion-form" class="portion">
        <label>Portion (g)
          <input id="portion-input" type="number" min="1" step="1" value="${defaultG}" />
        </label>
        ${product.servingG ? `<span class="muted">1 serving ≈ ${fmt(product.servingG)} g</span>` : ''}
        <button class="btn" type="submit">Add to today</button>
      </form>
    </section>`

  resultEl.querySelector('#portion-form').addEventListener('submit', (ev) => {
    ev.preventDefault()
    const grams = parseFloat(resultEl.querySelector('#portion-input').value)
    if (!grams || grams <= 0) return
    api.addProduct(product, grams, source)
  })
}

// ---- Search ----------------------------------------------------------------

function foodThumb(imageUrl, name) {
  if (imageUrl) return `<img class="food-thumb" src="${esc(imageUrl)}" alt="" />`
  const letter = (String(name || '?').trim().charAt(0) || '?').toUpperCase()
  return `<span class="food-thumb ph">${esc(letter)}</span>`
}

function recentRow(e, i) {
  const showQty = e.qty && e.source !== 'quick'
  return `
    <button class="food-row" data-recent="${i}">
      ${foodThumb('', e.name)}
      <div class="food-main">
        <div class="food-name">${esc(e.name)}</div>
        <div class="food-sub">${showQty ? `${fmt(e.qty)} g · ` : ''}P${fmt(e.protein)} C${fmt(
    e.carbs
  )} F${fmt(e.fat)}</div>
      </div>
      <div class="food-kcal"><b>${fmt(e.kcal)}</b><span>kcal</span></div>
      <span class="food-add">+</span>
    </button>`
}

function searchRow(p, i) {
  return `
    <button class="food-row" data-search="${i}">
      ${foodThumb(p.imageUrl, p.name)}
      <div class="food-main">
        <div class="food-name">${esc(p.name)}</div>
        <div class="food-sub">${p.brand ? esc(p.brand) + ' · ' : ''}per 100 g</div>
      </div>
      <div class="food-kcal"><b>${fmt(p.per100.kcal)}</b><span>kcal</span></div>
      <span class="food-add">+</span>
    </button>`
}

export function renderSearch(el, api) {
  const recents = recentFoods(10)

  el.innerHTML = `
    <header class="screen-head">
      <div><p class="eyebrow">Find food</p><h1>Search</h1></div>
    </header>

    <section class="card">
      <form id="search-form" class="search-form">
        <input id="search-input" type="search" enterkeyhint="search" autocomplete="off"
               placeholder="e.g. egg, shepherd's pie, banana" />
        <button class="btn" type="submit">Search</button>
      </form>
      <div id="search-state" class="search-state"></div>
      <ul id="search-results" class="food-list"></ul>
    </section>

    <section id="search-detail"></section>

    <section class="card">
      <h2>Recently eaten</h2>
      ${
        recents.length
          ? `<ul class="food-list">${recents.map(recentRow).join('')}</ul>`
          : `<p class="muted">Foods you log will show here for one-tap re-adding.</p>`
      }
    </section>`

  const form = el.querySelector('#search-form')
  const input = el.querySelector('#search-input')
  const stateEl = el.querySelector('#search-state')
  const resultsEl = el.querySelector('#search-results')
  const detailEl = el.querySelector('#search-detail')

  let results = []

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const q = input.value.trim()
    if (!q) return
    input.blur()
    detailEl.innerHTML = ''
    resultsEl.innerHTML = ''
    stateEl.innerHTML = '<div class="spinner"></div>'
    try {
      results = await api.searchFoods(q)
      stateEl.innerHTML = results.length
        ? ''
        : `<p class="muted">No matches for “${esc(q)}”. Try a simpler word, or use Quick add.</p>`
      resultsEl.innerHTML = results.map(searchRow).join('')
    } catch (err) {
      stateEl.innerHTML = `<p class="muted">Search failed: ${esc(err.message)}. Check your connection.</p>`
    }
  })

  // Tapping a result opens a portion form below the search box.
  resultsEl.addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-search]')
    if (!row) return
    const product = results[Number(row.dataset.search)]
    if (!product) return
    renderScanResult(detailEl, product, api, 'search')
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  // Tapping a recent re-logs it immediately.
  el.querySelectorAll('[data-recent]').forEach((btn) =>
    btn.addEventListener('click', () => {
      api.addRecent(recents[Number(btn.dataset.recent)])
    })
  )
}

// ---- History ---------------------------------------------------------------

export function renderHistory(el) {
  const days = listHistory()
  const profile = loadProfile()
  const targets = profile ? calcTargets(profile) : null

  el.innerHTML = `
    <header class="screen-head"><h1>History</h1></header>
    ${
      days.length === 0
        ? `<section class="card"><p class="muted">No history yet. Log some food and it'll show up here day by day.</p></section>`
        : days
            .map((d) => {
              const goal = targets ? targets.calories : 0
              const pct = goal ? Math.min(100, (d.totals.kcal / goal) * 100) : 0
              return `
            <section class="card day">
              <div class="day-head">
                <h2>${niceDate(d.date)}</h2>
                <span class="muted">${d.count} item${d.count === 1 ? '' : 's'}</span>
              </div>
              <div class="day-macros">
                <b>${d.totals.kcal}</b> kcal · P${d.totals.protein} C${d.totals.carbs} F${
                d.totals.fat
              }
              </div>
              ${
                goal
                  ? `<div class="bar-track sm"><div class="bar-fill" style="width:${pct}%"></div></div>`
                  : ''
              }
              <div class="day-extra muted">
                Additives: ${d.totals.additiveCount}${
                d.totals.novaWorst ? ` · worst NOVA ${d.totals.novaWorst}` : ''
              }
              </div>
            </section>`
            })
            .join('')
    }`
}

// ---- Profile ---------------------------------------------------------------

export function renderProfile(el, api) {
  const p = loadProfile() || {
    sex: 'male',
    age: 30,
    heightCm: 175,
    weightKg: 75,
    activity: 'moderate',
    goal: 'maintain'
  }
  const targets = calcTargets(p)

  const activityOpts = Object.entries(ACTIVITY_FACTORS)
    .map(
      ([k, v]) =>
        `<option value="${k}" ${k === p.activity ? 'selected' : ''}>${esc(v.label)}</option>`
    )
    .join('')
  const goalOpts = Object.entries(GOALS)
    .map(
      ([k, v]) => `<option value="${k}" ${k === p.goal ? 'selected' : ''}>${esc(v.label)}</option>`
    )
    .join('')

  el.innerHTML = `
    <header class="screen-head"><h1>Profile</h1></header>

    <section class="card">
      <form id="profile-form" class="profile">
        <div class="field-row">
          <label>Sex
            <select name="sex">
              <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option>
              <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option>
            </select>
          </label>
          <label>Age
            <input type="number" name="age" min="10" max="100" value="${p.age}" />
          </label>
        </div>
        <div class="field-row">
          <label>Height (cm)
            <input type="number" name="heightCm" min="100" max="230" value="${p.heightCm}" />
          </label>
          <label>Weight (kg)
            <input type="number" name="weightKg" min="30" max="300" step="0.1" value="${p.weightKg}" />
          </label>
        </div>
        <label>Activity
          <select name="activity">${activityOpts}</select>
        </label>
        <label>Goal
          <select name="goal">${goalOpts}</select>
        </label>
        <button class="btn" type="submit">Save &amp; recalculate</button>
      </form>
    </section>

    <section class="card" id="targets-card">
      <h2>Your daily targets</h2>
      <div class="targets">
        <div class="target big"><b>${targets.calories}</b><span>kcal/day</span></div>
        <div class="target"><b>${targets.protein}g</b><span>protein</span></div>
        <div class="target"><b>${targets.carbs}g</b><span>carbs</span></div>
        <div class="target"><b>${targets.fat}g</b><span>fat</span></div>
      </div>
      <p class="muted">BMR ${targets.bmr} · TDEE ${targets.tdee} kcal (Mifflin–St Jeor)</p>
    </section>`

  const form = el.querySelector('#profile-form')
  // Live preview of targets as fields change.
  const preview = () => {
    const data = readProfileForm(form)
    const t = calcTargets(data)
    const card = el.querySelector('#targets-card .targets')
    card.innerHTML = `
      <div class="target big"><b>${t.calories}</b><span>kcal/day</span></div>
      <div class="target"><b>${t.protein}g</b><span>protein</span></div>
      <div class="target"><b>${t.carbs}g</b><span>carbs</span></div>
      <div class="target"><b>${t.fat}g</b><span>fat</span></div>`
    el.querySelector('#targets-card .muted').textContent = `BMR ${t.bmr} · TDEE ${t.tdee} kcal (Mifflin–St Jeor)`
  }
  form.addEventListener('input', preview)
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    api.saveProfile(readProfileForm(form))
  })
}

function readProfileForm(form) {
  const fd = new FormData(form)
  return {
    sex: fd.get('sex'),
    age: Number(fd.get('age')),
    heightCm: Number(fd.get('heightCm')),
    weightKg: Number(fd.get('weightKg')),
    activity: fd.get('activity'),
    goal: fd.get('goal')
  }
}
