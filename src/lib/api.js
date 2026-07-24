// 資料層：.env 有 Supabase 設定就走雲端，否則走 localStorage 示範模式
import { createClient } from '@supabase/supabase-js'
import * as local from './localStore'
import { compressImage } from './image'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isLocal = !url || !key
// 開放模式：連 Supabase 但跳過登入（設計期用；資料庫端須先執行 supabase/open-mode.sql）
export const isOpen = !isLocal && import.meta.env.VITE_OPEN_MODE === '1'
const sb = isLocal ? null : createClient(url, key)

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
  if (isOpen) return
  await sb.auth.signOut()
}

// ── photos ──
// 壓縮後上傳；示範模式直接回傳 dataURL 存進記錄，正式模式上傳 Storage 回傳公開網址
export async function uploadPhoto(file) {
  const { blob, dataUrl } = await compressImage(file)
  if (isLocal) return dataUrl
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
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
  if (isLocal) return local.addComplaint(c)
  const { data, error } = await sb.from('complaints').insert(c).select().single()
  throwIf(error)
  return data
}
export async function updateComplaint(id, patch) {
  if (isLocal) return local.updateComplaint(id, patch)
  const { data, error } = await sb.from('complaints').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteComplaint(id) {
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
  if (isLocal) return local.addTopic(t)
  const { data, error } = await sb.from('topics').insert(t).select().single()
  throwIf(error)
  return data
}
export async function updateTopic(id, patch) {
  if (isLocal) return local.updateTopic(id, patch)
  const { data, error } = await sb.from('topics').update(patch).eq('id', id).select().single()
  throwIf(error)
  return data
}
export async function deleteTopic(id) {
  if (isLocal) return local.deleteTopic(id)
  const { error } = await sb.from('topics').delete().eq('id', id)
  throwIf(error)
}
export async function importSeedTopics(rows) {
  if (isLocal) return local.importSeedTopics(rows)
  const { error } = await sb.from('topics').insert(rows)
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
export async function clearFocus(date) {
  if (isLocal) return local.clearFocus(date)
  const { error } = await sb.from('daily_focus').delete().eq('focus_date', date)
  throwIf(error)
}
export async function markShared(date) {
  if (isLocal) return local.markShared(date)
  const { data, error } = await sb.from('daily_focus')
    .update({ shared_at: new Date().toISOString() }).eq('focus_date', date).select().single()
  throwIf(error)
  return data
}
