// 示範模式資料層：全部存 localStorage，介面與 Supabase 版一致
import { seedTopics, seedComplaints } from '../data/seedData'

const K = { user: 'hqms_user', complaints: 'hqms_complaints', topics: 'hqms_topics', focus: 'hqms_focus' }
const get = (k, fb) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb }
}
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const uid = () => crypto.randomUUID()

function ensureSeed() {
  if (!localStorage.getItem(K.topics))
    set(K.topics, seedTopics.map((t, i) => ({ id: uid(), sort_order: i, created_at: new Date().toISOString(), ...t })))
  if (!localStorage.getItem(K.complaints)) set(K.complaints, seedComplaints())
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
