// 示範模式資料層：全部存 localStorage，介面與 Supabase 版一致
import { seedTopics, seedComplaints, TRAINING, DEFAULT_CATEGORIES } from '../data/seedData'

const K = { user: 'hqms_user', complaints: 'hqms_complaints', topics: 'hqms_topics', focus: 'hqms_focus', training: 'hqms_training', categories: 'hqms_categories', attendants: 'hqms_attendants', scores: 'hqms_scores', periodic: 'hqms_periodic' }
const get = (k, fb) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb }
}
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const uid = () => crypto.randomUUID()

function ensureSeed() {
  if (!localStorage.getItem(K.topics))
    set(K.topics, seedTopics.map((t, i) => ({ id: uid(), sort_order: i, created_at: new Date().toISOString(), ...t })))
  if (!localStorage.getItem(K.complaints)) set(K.complaints, seedComplaints())
  if (!localStorage.getItem(K.training))
    set(K.training, TRAINING.map((t, i) => ({ id: uid(), sort_order: i, created_at: new Date().toISOString(), ...t })))
  if (!localStorage.getItem(K.categories))
    set(K.categories, DEFAULT_CATEGORIES.map((c, i) => ({ id: uid(), sort_order: i, created_at: new Date().toISOString(), ...c })))
}

// ── auth ──
export function getUser() { ensureSeed(); return get(K.user, null) }
export function signIn(username) { const u = { email: username }; set(K.user, u); return u }
export function signOut() { localStorage.removeItem(K.user) }

// ── complaints ──
export function listComplaints() {
  ensureSeed()
  return get(K.complaints, []).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''))
}
export function addComplaint(c) {
  const rows = get(K.complaints, [])
  const row = { id: uid(), created_at: new Date().toISOString(), ...c }
  rows.unshift(row); set(K.complaints, rows)
  return row
}
export function updateComplaint(id, patch) {
  const rows = get(K.complaints, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.complaints, rows)
  return rows.find(r => r.id === id)
}
export function deleteComplaint(id) {
  set(K.complaints, get(K.complaints, []).filter(r => r.id !== id))
  const f = get(K.focus, {})
  for (const d of Object.keys(f)) if (f[d].complaint_id === id) delete f[d]
  set(K.focus, f)
}

// ── topics ──
export function listTopics() {
  ensureSeed()
  return get(K.topics, []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}
export function addTopic(t) {
  const rows = get(K.topics, [])
  const row = { id: uid(), sort_order: rows.length, created_at: new Date().toISOString(), ...t }
  rows.push(row); set(K.topics, rows)
  return row
}
export function updateTopic(id, patch) {
  const rows = get(K.topics, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.topics, rows)
  return rows.find(r => r.id === id)
}
export function deleteTopic(id) {
  set(K.topics, get(K.topics, []).filter(r => r.id !== id))
  const f = get(K.focus, {})
  for (const d of Object.keys(f)) if (f[d].topic_id === id) delete f[d]
  set(K.focus, f)
}
export function importSeedTopics(rows) { for (const r of rows) addTopic(r) }

// ── periodic ──
export function listPeriodic() {
  ensureSeed()
  return get(K.periodic, []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}
export function addPeriodic(p) {
  const rows = get(K.periodic, [])
  const row = { id: uid(), sort_order: rows.length, created_at: new Date().toISOString(), ...p }
  rows.push(row); set(K.periodic, rows)
  return row
}
export function updatePeriodic(id, patch) {
  const rows = get(K.periodic, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.periodic, rows)
  return rows.find(r => r.id === id)
}
export function deletePeriodic(id) {
  set(K.periodic, get(K.periodic, []).filter(r => r.id !== id))
}
export function importSeedPeriodic(rows) { for (const r of rows) addPeriodic(r) }

// ── categories ──
export function listCategories() {
  ensureSeed()
  return get(K.categories, []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}
export function addCategory(c) {
  const rows = get(K.categories, [])
  const row = { id: uid(), sort_order: rows.length, created_at: new Date().toISOString(), ...c }
  rows.push(row); set(K.categories, rows)
  return row
}
export function updateCategory(id, patch, oldName) {
  const rows = get(K.categories, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.categories, rows)
  if (patch.name && oldName && patch.name !== oldName) {
    set(K.topics, get(K.topics, []).map(t => (t.category === oldName ? { ...t, category: patch.name } : t)))
    set(K.complaints, get(K.complaints, []).map(c => (c.category === oldName ? { ...c, category: patch.name } : c)))
  }
  return rows.find(r => r.id === id)
}
export function deleteCategory(id, name) {
  const used = get(K.topics, []).some(t => t.category === name) || get(K.complaints, []).some(c => c.category === name)
  if (used) throw new Error('仍有主題或客訴使用此分類，請先改走它們')
  set(K.categories, get(K.categories, []).filter(r => r.id !== id))
}

// ── attendants ──
export function listAttendants() {
  ensureSeed()
  return get(K.attendants, []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}
export function addAttendant(a) {
  const rows = get(K.attendants, [])
  const row = { id: uid(), active: true, sort_order: rows.length, created_at: new Date().toISOString(), ...a }
  rows.push(row); set(K.attendants, rows)
  return row
}
export function updateAttendant(id, patch) {
  const rows = get(K.attendants, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.attendants, rows)
  return rows.find(r => r.id === id)
}
export function deleteAttendant(id) {
  if (get(K.scores, []).some(s => s.attendant_id === id)) throw new Error('此房務員已有評分記錄，請改用「停用」')
  set(K.attendants, get(K.attendants, []).filter(r => r.id !== id))
}

// ── scores ──
export function listScores() {
  ensureSeed()
  return get(K.scores, []).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''))
}
export function addScore(s) {
  const rows = get(K.scores, [])
  const row = { id: uid(), created_at: new Date().toISOString(), ...s }
  rows.unshift(row); set(K.scores, rows)
  return row
}
export function updateScore(id, patch) {
  const rows = get(K.scores, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.scores, rows)
  return rows.find(r => r.id === id)
}
export function deleteScore(id) {
  set(K.scores, get(K.scores, []).filter(r => r.id !== id))
}

// ── training ──
export function listTraining() {
  ensureSeed()
  return get(K.training, []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}
export function addTraining(t) {
  const rows = get(K.training, [])
  const row = { id: uid(), sort_order: rows.length, created_at: new Date().toISOString(), ...t }
  rows.push(row); set(K.training, rows)
  return row
}
export function updateTraining(id, patch) {
  const rows = get(K.training, []).map(r => (r.id === id ? { ...r, ...patch } : r))
  set(K.training, rows)
  return rows.find(r => r.id === id)
}
export function deleteTraining(id) {
  set(K.training, get(K.training, []).filter(r => r.id !== id))
}
export function importSeedTraining(rows) { for (const r of rows) addTraining(r) }

// ── daily focus ──
export function getFocus(date) { ensureSeed(); return get(K.focus, {})[date] ?? null }
export function setFocus(row) {
  const f = get(K.focus, {})
  f[row.focus_date] = { shared_at: null, ...row }
  set(K.focus, f)
  return f[row.focus_date]
}
export function clearFocus(date) { const f = get(K.focus, {}); delete f[date]; set(K.focus, f) }
export function markShared(date) {
  const f = get(K.focus, {})
  if (f[date]) f[date].shared_at = new Date().toISOString()
  set(K.focus, f)
  return f[date]
}
