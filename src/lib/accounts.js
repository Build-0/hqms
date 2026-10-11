// 帳號與權限。只存密碼雜湊；這是前端權限，不等於資料庫權限。
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
  { key: '101428', id: '101428', name: 'Benny Liang', role: 'admin', h: '901b3984c5d157ef0f4420d64f8a64d1b618c1f415397978ea155745b4c40e7c' },
  { key: '100663', id: '100663', name: 'Winnie Weng', role: 'admin', h: 'bd866592c407e1d71fdb6bb5e61aa61607f41b21c498b4ef9a0220f852436635' },
  { key: '100830', id: '100830', name: 'Ice Zhang', role: 'admin', h: '45ecd4680bf8150732a3c635ddbc32c589d259598eda0f5f92d37b97eb430777' },
  { key: '101117', id: '101117', name: 'Kit Law', role: 'admin', h: 'f4e1541c4a67d7c66e752a39cab1cfc3ea62917b19941b5ec6eb4b3c7d915bf4' },
  { key: '101082', id: '101082', name: 'Duncan Wang', role: 'store', h: '0a2ff7964c250afbee366225409307a2145b29cd9779294936b9534dfd0d6e34' },
  { key: '101055', id: '101055', name: 'Ray Liao', role: 'store', h: 'd218613e13d79df1a94fd6891dc6a0cb198b6aa3024ede6e71f0c7edeb5c5fad' },
  { key: '100684', id: '100684', name: 'Abby Liu', role: 'clerk', h: '010eb8b8e81a90475fbc57fb43615336951eb15e7a00e12e0d03d0eff77fcff9' },
  { key: '101323', id: '101323', name: 'Nico Yan', role: 'clerk', h: 'e7f1f329a90f1144f647d2ad8813735e88773dfc16dea01b5c56a368d71ab3f9' },
  { key: '100266', id: '100266', name: 'Irene Lin', role: 'supervisor', h: 'f34cb49a43c8eaefe49169dd76e0c62ab4ff7f22c95b7029e25f89344a453ada' },
  { key: '101488', id: '101488', name: 'Candy Huang', role: 'supervisor', h: '7861080ea570274c14b6f98875620dee91f777b4de9079edddfb8b2386736500' },
  { key: '100276', id: '100276', name: 'Cici Li', role: 'supervisor', h: 'b28e68362b821830ee8eb999b2fd922a356452642e76013655a0c2e3441c367e' },
  { key: '101170', id: '101170', name: 'Gigi Zeng', role: 'supervisor', h: '5aee6a8dfb9366e757e0fb82d1239cbd116ee4009e35d3b8e123c27a3ed77e03' },
  { key: '100662', id: '100662', name: 'Annie Feng', role: 'supervisor', h: '3abf2ab3e8ff52b526f8cb5f15f7eeab450ce7774c097c9c64168a04389b4c9f' },
  { key: '100667', id: '100667', name: 'Bobo Zhang', role: 'supervisor', h: 'e600ffbdeb2b8b0a9f3b9e86b7504ca903ceca9b42d053c349d3ebf9d75301bb' },
  { key: '100668', id: '100668', name: 'Rose Zhang', role: 'supervisor', h: '5ab965294548b72cf38b9514b006757c1790a3c647184084133d383dbc28aa7d' },
  { key: '100658', id: '100658', name: 'Linda Wu', role: 'supervisor', h: '633629c8cb6aa783b858ba5872b29c1bbf6d93e8b6c85b22aa8059485eb8bf88' },
  { key: '100262', id: '100262', name: 'Jenny Nip', role: 'supervisor', h: '3ae63deb5cd003fce39eadd7750a5ac320a45fa3ac18893b6d561ff9d51a9038' },
  { key: '100224', id: '100224', name: 'Cindy Ngan', role: 'supervisor', h: '5823a72676d4611912dc6eb2cc1d77d11f0a73a9800807bb83c4923647ebed7b' },
  { key: '100922', id: '100922', name: 'Edward Xu', role: 'supervisor', h: '8ebc8d063de8f7ef6f93a80c4395a9362785118d447492bc3d37ec99ff949a39' },
  { key: '100779', id: '100779', name: 'Ling Gong', role: 'supervisor', h: 'f9645ad1e06ebeee08f6b3a26083d7274f0e6ad67f3d6b3ed27762665e3113d6' },
  { key: '101494', id: '101494', name: 'Nick Su', role: 'supervisor', h: 'e0c71963433a28e2974d28726ae610125bb4b0152c90bc8628fbd22be2fc0050' },
  { key: '100957', id: '100957', name: 'David Kim', role: 'supervisor', h: '3d9902a72fd67069c50fb83a04e496034d8447cc829a53408aaf62a7d0cedc07' },
  { key: '100660', id: '100660', name: 'Eddie Li', role: 'supervisor', h: 'e10aec7946aeab405d7d1ef3d7f2d1168d328a5425c59a348e2b13d8c479e453' },
  { key: '100617', id: '100617', name: 'Serito Froilan', role: 'supervisor', h: '9e1b2df9f7c0b37d55e57b3de83cf91fa7146bb55322dd3bee6ad63c2d4c095f' },
  { key: '100669', id: '100669', name: 'Tony Cao', role: 'supervisor', h: 'c29c090ba62f69669295d8c7ad31e160e48e3797210cb18cea76743609a2af0f' },
  { key: '100926', id: '100926', name: 'Joe Huang', role: 'supervisor', h: '0777ffc7338c7e7cb29824ce407867b0929f8b96aef8a9938124e4382a3779d2' },
]

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// 以帳號名（或主管員工編號）加密碼驗證，成功回傳帳號
export async function verifyLogin(input, password) {
  const k = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!k) return null
  const first = a => a.name.toLowerCase().split(' ')[0]
  const acc = ACCOUNTS.find(a => a.key === k || a.name.toLowerCase() === k)
    || (ACCOUNTS.filter(a => first(a) === k).length === 1 ? ACCOUNTS.find(a => first(a) === k) : null)
  if (!acc) return null
  return (await sha256(`hotel-v2:${acc.key}:${password}`)) === acc.h ? acc : null
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
