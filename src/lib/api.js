// 資料層：.env 有 Supabase 設定就走雲端，否則走 localStorage 示範模式
import { createClient } from '@supabase/supabase-js'
import * as local from './localStore'
import { compressImage } from './image'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isLocal = !url || !key
// 員工帳號模式：用員工編號＋密碼登入 Supabase（資料庫端按角色把關，見 supabase/secure-lock.sql）
export const isOpen = !isLocal && import.meta.env.VITE_OPEN_MODE === '1'
const sb = isLocal ? null : createClient(url, key)

let readOnly = false
export const setReadOnly = v => { readOnly = !!v }
const guard = () => { if (readOnly) throw new Error('目前帳號只可查看，不能修改') }

function throwIf(error) { if (error) throw new Error(error.message) }

// ── auth ──
export async function getUser() {
  if (isLocal) return local.getUser()
  if (isOpen) return { email: 'open-mode' }
  const { data } = await sb.auth.getSession()
  return data.session?.user ?? null
}
export function onAuthChange(cb) {
  if (isLocal || isOpen) return () => {}
  const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user ?? null))
  return () => data.subscription.unsubscribe()
}
export async function signIn(username, password) {
  if (isLocal) {
    if (!username) throw new Error('請輸入帳號')
    return local.signIn(username)
  }
  const email = username.includes('@') ? username : `${username}@hqms.local`
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error('帳號或密碼不正確')
  return data.user
}
export async function signOut() {
  if (isLocal) return local.signOut()
  await sb.auth.signOut()
}
// 站內員工帳號（員工編號 → <編號>@hqms.local）：真正登入 Supabase，資料庫按角色把關
export async function signInStaff(empId, password) {
  const { error } = await sb.auth.signInWithPassword({ email: `${empId}@hqms.local`, password })
  if (error) throw new Error('帳號或密碼不正確')
}
export async function hasAuth() {
  const { data } = await sb.auth.getSession()
  return !!data.session
}
export function onSignedOut(cb) {
  const { data } = sb.auth.onAuthStateChange(e => { if (e === 'SIGNED_OUT') cb() })
  return () => data.subscription.unsubscribe()
}

// ── categories ──
export async function listCategories() {
  if (isLocal) return local.listCategories()
  const { data, error } = await sb.from('categories').select('*').order('sort_order').order('created_at')
  if (error) return null // 資料表未建立（尚未執行 add-modules.sql）→ 呼叫端退回預設分類
  return data
}
export async function addCategory(c) {
  guard()
  if (isLocal) return local.addCategory(c)
  const { data, error } = await sb.from('categories').insert(c).select().single()
  throwIf(error)
  return data
}
// 改名時同步更新既有主題與客訴的分類文字
export async function updateCategory(id, patch, oldName) {
  guard()
  if (isLocal) return local.updateCategory(id, patch, oldName)
  const { data, error } = await sb.from('categories').update(patch).eq('id', id).select().single()
  throwIf(error)
  if (patch.name && oldName && patch.name !== oldName) {
    await sb.from('topics').update({ category: patch.name }).eq('category', oldName)
    await sb.from('complaints').update({ category: patch.name }).eq('category', oldName)
  }
  return data
}
export async function deleteCategory(id, name) {
  guard()
  if (isLocal) return local.deleteCategory(id, name)
  const [t, c] = await Promise.all([
    sb.from('topics').select('id').eq('category', name).limit(1),
    sb.from('complaints').select('id').eq('category', name).limit(1),
  ])
  if (t.data?.length || c.data?.length) throw new Error('仍有主題或客訴使用此分類，請先改走它們')
  const { error } = await sb.from('categories').delete().eq('id', id)
  throwIf(error)
}

// ── attendants（房務員名單）──
export async function listAttendants() {
  if (isLocal) return local.listAttendants()
  const { data, error } = await sb.from('attendants').select('*').order('sort_order').order('created_at')
  throwIf(error)
  return data
}
export async function addAttendant(a) {
  guard()
  if (isLocal) return local.addAttendant(a)
  const { data, error } = await sb.from('attendants').insert(a).select().single()
  throwIf(error)
  return data
}
export async function updateAttendant(id, patch) {
  guard()
  if (isLocal) return local.updateAttendant(id, patch)
  const { data, error } = await sb.from('attendants').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteAttendant(id) {
  guard()
  if (isLocal) return local.deleteAttendant(id)
  const { data: s } = await sb.from('scores').select('id').eq('attendant_id', id).limit(1)
  if (s?.length) throw new Error('此房務員已有評分記錄，請改用「停用」')
  const { data: fd } = await sb.from('findings').select('id').eq('attendant_id', id).limit(1)
  if (fd?.length) throw new Error('此房務員已有查房記錄，請改用「停用」')
  const { error } = await sb.from('attendants').delete().eq('id', id)
  throwIf(error)
}

// ── scores（清潔評分）──
export async function listScores() {
  if (isLocal) return local.listScores()
  const { data, error } = await sb.from('scores').select('*')
    .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  throwIf(error)
  return data
}
export async function addScore(s) {
  guard()
  if (isLocal) return local.addScore(s)
  const { data, error } = await sb.from('scores').insert(s).select().single()
  throwIf(error)
  return data
}
export async function updateScore(id, patch) {
  guard()
  if (isLocal) return local.updateScore(id, patch)
  const { data, error } = await sb.from('scores').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteScore(id) {
  guard()
  if (isLocal) return local.deleteScore(id)
  const { error } = await sb.from('scores').delete().eq('id', id)
  throwIf(error)
}

// ── photos ──
// 壓縮後上傳；示範模式直接回傳 dataURL 存進記錄，正式模式上傳 Storage 回傳公開網址
export async function uploadPhoto(file) {
  guard()
  const { blob, dataUrl } = await compressImage(file)
  if (isLocal) return dataUrl
  const isGif = file.type === 'image/gif'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${isGif ? 'gif' : 'jpg'}`
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: isGif ? 'image/gif' : 'image/jpeg' })
  throwIf(error)
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl
}

// ── complaints ──
export async function listComplaints() {
  if (isLocal) return local.listComplaints()
  const { data, error } = await sb.from('complaints').select('*')
    .order('date', { ascending: false }).order('created_at', { ascending: false })
  throwIf(error)
  return data
}
export async function addComplaint(c) {
  guard()
  if (isLocal) return local.addComplaint(c)
  const { data, error } = await sb.from('complaints').insert(c).select().single()
  throwIf(error)
  return data
}
export async function updateComplaint(id, patch) {
  guard()
  if (isLocal) return local.updateComplaint(id, patch)
  const { data, error } = await sb.from('complaints').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteComplaint(id) {
  guard()
  if (isLocal) return local.deleteComplaint(id)
  const { error } = await sb.from('complaints').delete().eq('id', id)
  throwIf(error)
}

// ── topics ──
export async function listTopics() {
  if (isLocal) return local.listTopics()
  const { data, error } = await sb.from('topics').select('*').order('sort_order').order('created_at')
  throwIf(error)
  return data
}
export async function addTopic(t) {
  guard()
  if (isLocal) return local.addTopic(t)
  const { data, error } = await sb.from('topics').insert(t).select().single()
  throwIf(error)
  return data
}
export async function updateTopic(id, patch) {
  guard()
  if (isLocal) return local.updateTopic(id, patch)
  const { data, error } = await sb.from('topics').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteTopic(id) {
  guard()
  if (isLocal) return local.deleteTopic(id)
  const { error } = await sb.from('topics').delete().eq('id', id)
  throwIf(error)
}
export async function importSeedTopics(rows) {
  guard()
  if (isLocal) return local.importSeedTopics(rows)
  const { error } = await sb.from('topics').insert(rows)
  throwIf(error)
}

// ── training ──
export async function listTraining() {
  if (isLocal) return local.listTraining()
  const { data, error } = await sb.from('training_sections').select('*').order('sort_order').order('created_at')
  throwIf(error)
  return data
}
export async function addTraining(t) {
  guard()
  if (isLocal) return local.addTraining(t)
  const { data, error } = await sb.from('training_sections').insert(t).select().single()
  throwIf(error)
  return data
}
export async function updateTraining(id, patch) {
  guard()
  if (isLocal) return local.updateTraining(id, patch)
  const { data, error } = await sb.from('training_sections').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteTraining(id) {
  guard()
  if (isLocal) return local.deleteTraining(id)
  const { error } = await sb.from('training_sections').delete().eq('id', id)
  throwIf(error)
}
export async function importSeedTraining(rows) {
  guard()
  if (isLocal) return local.importSeedTraining(rows)
  const { error } = await sb.from('training_sections').insert(rows)
  throwIf(error)
}

// ── cleaning（加強清潔項目）──
export async function listCleaning() {
  if (isLocal) return local.listCleaning()
  const { data, error } = await sb.from('cleaning_items').select('*').order('sort_order').order('day').order('created_at')
  throwIf(error)
  return data
}
export async function addCleaning(c) {
  guard()
  if (isLocal) return local.addCleaning(c)
  const { data, error } = await sb.from('cleaning_items').insert(c).select().single()
  throwIf(error)
  return data
}
export async function updateCleaning(id, patch) {
  guard()
  if (isLocal) return local.updateCleaning(id, patch)
  const { data, error } = await sb.from('cleaning_items').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteCleaning(id) {
  guard()
  if (isLocal) return local.deleteCleaning(id)
  const { error } = await sb.from('cleaning_items').delete().eq('id', id)
  throwIf(error)
}
export async function importSeedCleaning(rows) {
  guard()
  if (isLocal) return local.importSeedCleaning(rows)
  const { error } = await sb.from('cleaning_items').insert(rows)
  throwIf(error)
}

// ── daily focus ──
export async function getFocus(date) {
  if (isLocal) return local.getFocus(date)
  const { data, error } = await sb.from('daily_focus').select('*').eq('focus_date', date).maybeSingle()
  throwIf(error)
  return data
}
export async function setFocus(row) {
  if (isLocal) return local.setFocus(row)
  const { data, error } = await sb.from('daily_focus').upsert(row, { onConflict: 'focus_date' }).select().single()
  throwIf(error)
  return data
}
export async function patchFocus(date, patch) {
  if (isLocal) return local.patchFocus(date, patch)
  const { data, error } = await sb.from('daily_focus').update(patch).eq('focus_date', date).select().single()
  throwIf(error)
  return data
}
export async function clearFocus(date) {
  guard()
  if (isLocal) return local.clearFocus(date)
  const { error } = await sb.from('daily_focus').delete().eq('focus_date', date)
  throwIf(error)
}
export async function markShared(date) {
  guard()
  if (isLocal) return local.markShared(date)
  const { data, error } = await sb.from('daily_focus')
    .update({ shared_at: new Date().toISOString() }).eq('focus_date', date).select().single()
  throwIf(error)
  return data
}

// ── findings（查房快速記錄）──
export async function listFindingTags() {
  if (isLocal) return local.listFindingTags()
  const { data, error } = await sb.from('finding_tags').select('*').order('sort_order').order('created_at')
  throwIf(error)
  return data
}
export async function addFindingTag(t) {
  guard()
  if (isLocal) return local.addFindingTag(t)
  const { data, error } = await sb.from('finding_tags').insert(t).select().single()
  throwIf(error)
  return data
}
export async function updateFindingTag(id, patch) {
  guard()
  if (isLocal) return local.updateFindingTag(id, patch)
  const { data, error } = await sb.from('finding_tags').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteFindingTag(id) {
  guard()
  if (isLocal) return local.deleteFindingTag(id)
  const { error } = await sb.from('finding_tags').delete().eq('id', id)
  throwIf(error)
}
export async function listFindings(sinceDate) {
  if (isLocal) return local.listFindings(sinceDate)
  let q = sb.from('findings').select('*')
  if (sinceDate) q = q.gte('date', sinceDate)
  const { data, error } = await q.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(2000)
  throwIf(error)
  return data
}
export async function addFindings(rows) {
  guard()
  if (isLocal) return local.addFindings(rows)
  const { data, error } = await sb.from('findings').insert(rows).select()
  throwIf(error)
  return data
}
export async function deleteFinding(id) {
  guard()
  if (isLocal) return local.deleteFinding(id)
  const { error } = await sb.from('findings').delete().eq('id', id)
  throwIf(error)
}

// ── defects（房間缺陷登記）──
export async function listDefects() {
  if (isLocal) return local.listDefects()
  const { data, error } = await sb.from('defect_records').select('*').order('created_at', { ascending: false }).limit(5000)
  throwIf(error)
  return data
}
export async function addDefect(row) {
  if (isLocal) return local.addDefect(row)
  const { data, error } = await sb.from('defect_records').insert(row).select().single()
  throwIf(error)
  return data
}
export async function updateDefect(id, patch) {
  if (isLocal) return local.updateDefect(id, patch)
  const { data, error } = await sb.from('defect_records').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteDefect(id) {
  if (isLocal) return local.deleteDefect(id)
  const { error } = await sb.from('defect_records').delete().eq('id', id)
  throwIf(error)
}
export async function listDefectTypes() {
  if (isLocal) return local.listDefectTypes()
  const { data, error } = await sb.from('defect_types').select('*').order('id')
  throwIf(error)
  return data
}
export async function addDefectType(name) {
  if (isLocal) return local.addDefectType(name)
  const { error } = await sb.from('defect_types').insert({ name })
  throwIf(error)
}
export async function deleteDefectType(name) {
  if (isLocal) return local.deleteDefectType(name)
  const { error } = await sb.from('defect_types').delete().eq('name', name)
  throwIf(error)
}

// ── 後勤管理用的通用資料存取（表格操作 + RPC）──
const needDb = () => { if (!sb) throw new Error('示範模式不支援後勤資料，請在正式網站使用') }
export async function dbSelect(table, { cols = '*', order = 'id', asc = true, eq } = {}) {
  needDb()
  let q = sb.from(table).select(cols)
  if (eq) for (const [k, v] of Object.entries(eq)) q = q.eq(k, v)
  const { data, error } = await q.order(order, { ascending: asc }).limit(5000)
  throwIf(error)
  return data
}
export async function dbSelectIn(table, cols, ids) {
  needDb()
  const { data, error } = await sb.from(table).select(cols).in('id', ids)
  throwIf(error)
  return data
}
export async function dbInsert(table, row) {
  needDb()
  const { data, error } = await sb.from(table).insert(row).select().single()
  throwIf(error)
  return data
}
export async function dbUpdate(table, id, patch) {
  needDb()
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function dbDelete(table, id) {
  needDb()
  const { error } = await sb.from(table).delete().eq('id', id)
  throwIf(error)
}
export async function dbRpc(fn, args) {
  needDb()
  const { data, error } = await sb.rpc(fn, { p_password: '', ...args })
  throwIf(error)
  return data
}
