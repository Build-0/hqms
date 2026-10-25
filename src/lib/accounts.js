// 帳號清單（只用來把輸入對應到員工編號、顯示姓名與角色；密碼由 Supabase Auth 驗證，真正權限由資料庫 RLS 把關）。
// 角色：admin 管理員／store 倉管員／clerk 文員／supervisor 樓層主管（來自原缺陷系統，已排除已改任其他角色者）
export const ROLE_LABEL = { admin: '管理員', store: '倉管員', clerk: '文員', supervisor: '樓層主管' }

// 各系統權限：edit 可編輯／register 只可登記（缺陷）／none 封鎖（顯示為灰色，點擊不能進入）
export const PERMS = {
  admin: { quality: 'edit', findings: 'edit', boh: 'edit', defect: 'edit', public: 'edit' },
  store: { quality: 'none', findings: 'none', boh: 'edit', defect: 'edit' },
  clerk: { quality: 'none', findings: 'none', boh: 'none', defect: 'edit' },
  supervisor: { quality: 'none', findings: 'add', boh: 'none', defect: 'register' },   // 查房記錄：可查看與新增，不能刪改
}

// 樓層主管負責的樓層（員工編號 → 樓層）。未設定的主管，首頁改為顯示「自己登記過」的缺陷。
export const SUP_FLOORS = {
  '100266': ['3'],   // Irene Lin
  '101488': ['4'],   // Candy Huang
  '100276': ['5'],   // Cici Li
  '101170': ['6'],   // Gigi Zeng
  '100662': ['7'],   // Annie Feng
  '100667': ['8'],   // Bobo Zhang
  '100668': ['9'],   // Rose Zhang
  '100658': ['10'],  // Linda Wu
  '100262': ['11'],  // Jenny Nip
  '100224': ['12'],  // Cindy Ngan
}

// 公共地區：管理員可改；公眾主管（帳號有 pub 旗標）可查看；其他帳號沒有
export const publicPerm = s => (!s ? 'edit' : s.role === 'admin' ? 'edit' : s.pub ? 'view' : 'none')

// 逐項權限：每個「卡片」都可獨立設定 無／查看／新增／編輯（開發者喺「權限管理」設定，資料庫 perm_items 為準）
export const ITEMS = [
  { id: 'daily', group: '房間品質', label: '今日重點' },
  { id: 'findings', group: '房間品質', label: '查房記錄', add: true },
  { id: 'topics', group: '房間品質', label: '培訓主題庫' },
  { id: 'cyclic', group: '房間品質', label: '清潔要點' },
  { id: 'complaint', group: '房間品質', label: '客訴管理' },
  { id: 'boh', group: '後勤管理', label: '後勤管理（整個模組）' },
  { id: 'uniform', group: '後勤管理', label: '制服房管理（開發中）' },
  { id: 'writeoff', group: '後勤管理', label: '報銷與遺失管理（開發中）' },
  { id: 'defect', group: '缺陷管理', label: '缺陷管理（整個模組）', add: true },
  { id: 'pa_roster', group: '公共地區', label: '人員崗位' },
  { id: 'pa_tasks', group: '公共地區', label: '任務代碼' },
  { id: 'pa_board', group: '公共地區', label: '24 小時看板' },
  { id: 'pa_annual', group: '公共地區', label: '年度清潔' },
  { id: 'pa_stock', group: '公共地區', label: '物資清點' },
]
export const LEVEL_LABEL = { none: '無', view: '查看', add: '新增', edit: '編輯' }
// 角色預設（未有逐項設定時）
export function itemDefault(s, id) {
  if (!s) return 'edit'
  if (id === 'uniform' || id === 'writeoff') return s.dev ? 'edit' : 'none'   // 開發中：預設只有開發者可入
  const r = s.role
  if (r === 'admin') return 'edit'
  if (r === 'store') return id === 'boh' || id === 'defect' ? 'edit' : 'none'
  if (r === 'clerk') return id === 'defect' ? 'edit' : 'none'
  if (r === 'supervisor') {
    if (id === 'findings' || id === 'defect') return 'add'
    if (id.startsWith('pa_')) return s.pub ? 'view' : 'none'
  }
  return 'none'
}
export const itemLevel = (s, id) => (!s ? 'edit' : (s.items && s.items[id]) || itemDefault(s, id))
// 舊式「PERMS」形狀（Home／Boh／Defects／Findings 等頁面沿用），由逐項等級計算
export function permsOf(s) {
  if (!s) return { quality: 'edit', findings: 'edit', boh: 'edit', defect: 'edit', public: 'edit' }
  const q = ['daily', 'topics', 'cyclic', 'complaint'].map(i => itemLevel(s, i))
  const d = itemLevel(s, 'defect')
  return {
    quality: q.every(x => x === 'edit') ? 'edit' : q.some(x => x !== 'none') ? 'view' : 'none',
    findings: itemLevel(s, 'findings'),
    boh: itemLevel(s, 'boh'),
    defect: d === 'add' ? 'register' : d,
    public: ITEMS.filter(i => i.id.startsWith('pa_')).some(i => itemLevel(s, i.id) !== 'none') ? 'view' : 'none',
  }
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
  { key: '100922', id: '100922', name: 'Edward Xu', role: 'supervisor', pub: true },
  { key: '100779', id: '100779', name: 'Ling Gong', role: 'supervisor' },
  { key: '101494', id: '101494', name: 'Nick Su', role: 'supervisor', pub: true },
  { key: '100957', id: '100957', name: 'David Kim', role: 'supervisor', pub: true },
  { key: '100660', id: '100660', name: 'Eddie Li', role: 'supervisor', pub: true },
  { key: '100617', id: '100617', name: 'Serito Froilan', role: 'supervisor', pub: true },
  { key: '100669', id: '100669', name: 'Tony Cao', role: 'supervisor', pub: true },
  { key: '100926', id: '100926', name: 'Joe Huang', role: 'supervisor' },
  { key: '100892', id: '100892', name: 'Anna Song', role: 'supervisor', pub: true },
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
// 資料庫內的最新角色／旗標（登入後讀取）蓋過程式內的預設值，令開發者可以在系統內改權限
let OV = null
export const applyOverride = (key, fields) => { OV = { key, fields } }
export const getSession = () => {
  try {
    const k = localStorage.getItem(SKEY); const a = ACCOUNTS.find(x => x.key === k) || null
    return a && OV && OV.key === a.key ? { ...a, ...OV.fields } : a
  } catch { return null }
}
export const setSession = acc => { try { localStorage.setItem(SKEY, acc.key) } catch {} }
export const clearSession = () => { try { localStorage.removeItem(SKEY) } catch {} }

// 匯出（PDF、CSV）只限管理員；非「開放登入」模式（Supabase 帳號）視為管理員
export const EXPORT_MSG = '匯出功能只限管理員使用，請聯繫管理員。'
export function canExport() {
  const acc = getSession()
  return !acc || acc.role === 'admin'
}
