// 帳號清單（只用來把輸入對應到員工編號、顯示姓名與角色；密碼由 Supabase Auth 驗證，真正權限由資料庫 RLS 把關）。
// 角色：admin 管理員／store 倉管員／clerk 文員／supervisor 樓層主管（來自原缺陷系統，已排除已改任其他角色者）
export const ROLE_LABEL = { admin: '管理員', store: '倉管員', clerk: '文員', supervisor: '樓層主管' }

// 各系統權限：edit 可編輯／register 只可登記（缺陷）／none 封鎖（顯示為灰色，點擊不能進入）
export const PERMS = {
  admin: { quality: 'edit', boh: 'edit', defect: 'edit' },
  store: { quality: 'none', boh: 'edit', defect: 'edit' },
  clerk: { quality: 'none', boh: 'none', defect: 'edit' },
  supervisor: { quality: 'none', boh: 'none', defect: 'register' },
}

export const ACCOUNTS = [
  { key: '101428', id: '101428', name: 'Benny Liang', role: 'admin' },
  { key: '100663', id: '100663', name: 'Winnie Weng', role: 'admin' },
  { key: '100830', id: '100830', name: 'Ice Zhang', role: 'admin' },
  { key: '101117', id: '101117', name: 'Kit Law', role: 'admin' },
  { key: '101082', id: '101082', name: 'Duncan Wang', role: 'store' },
  { key: '101055', id: '101055', name: 'Ray Liao', role: 'store' },
  { key: '100684', id: '100684', name: 'Abby Liu', role: 'clerk' },
  { key: '101323', id: '101323', name: 'Nico Yan', role: 'clerk' },
  { key: '100266', id: '100266', name: 'Irene Lin', role: 'supervisor' },
  { key: '101488', id: '101488', name: 'Candy Huang', role: 'supervisor' },
  { key: '100276', id: '100276', name: 'Cici Li', role: 'supervisor' },
  { key: '101170', id: '101170', name: 'Gigi Zeng', role: 'supervisor' },
  { key: '100662', id: '100662', name: 'Annie Feng', role: 'supervisor' },
  { key: '100667', id: '100667', name: 'Bobo Zhang', role: 'supervisor' },
  { key: '100668', id: '100668', name: 'Rose Zhang', role: 'supervisor' },
  { key: '100658', id: '100658', name: 'Linda Wu', role: 'supervisor' },
  { key: '100262', id: '100262', name: 'Jenny Nip', role: 'supervisor' },
  { key: '100224', id: '100224', name: 'Cindy Ngan', role: 'supervisor' },
  { key: '100922', id: '100922', name: 'Edward Xu', role: 'supervisor' },
  { key: '100779', id: '100779', name: 'Ling Gong', role: 'supervisor' },
  { key: '101494', id: '101494', name: 'Nick Su', role: 'supervisor' },
  { key: '100957', id: '100957', name: 'David Kim', role: 'supervisor' },
  { key: '100660', id: '100660', name: 'Eddie Li', role: 'supervisor' },
  { key: '100617', id: '100617', name: 'Serito Froilan', role: 'supervisor' },
  { key: '100669', id: '100669', name: 'Tony Cao', role: 'supervisor' },
  { key: '100926', id: '100926', name: 'Joe Huang', role: 'supervisor' },
]

// 把輸入（員工編號、英文全名、或唯一的名字）對應到帳號；密碼不在這裡驗證
export function findAccount(input) {
  const k = String(input || '').trim().toLowerCase().replace(/s+/g, ' ')
  if (!k) return null
  const first = a => a.name.toLowerCase().split(' ')[0]
  return ACCOUNTS.find(a => a.key === k || a.name.toLowerCase() === k)
    || (ACCOUNTS.filter(a => first(a) === k).length === 1 ? ACCOUNTS.find(a => first(a) === k) : null)
}

const SKEY = 'hotel_session'
export const getSession = () => {
  try { const k = localStorage.getItem(SKEY); return ACCOUNTS.find(a => a.key === k) || null } catch { return null }
}
export const setSession = acc => { try { localStorage.setItem(SKEY, acc.key) } catch {} }
export const clearSession = () => { try { localStorage.removeItem(SKEY) } catch {} }

// 匯出（PDF、CSV）只限管理員；非「開放登入」模式（Supabase 帳號）視為管理員
export const EXPORT_MSG = '匯出功能只限管理員使用，請聯繫管理員。'
export function canExport() {
  const acc = getSession()
  return !acc || acc.role === 'admin'
}
