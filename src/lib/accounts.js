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
  { key: 'benny', name: 'Benny', role: 'admin', h: 'd9631e1d951ce64bee6e4ad7c67862023ad6587a322370720067234f2f9698c8' },
  { key: 'winnie', name: 'Winnie', role: 'admin', h: '112a68568856924b77276e4ebbf651e0bc19f70c877b72cec3c4127c9805012c' },
  { key: 'ice', name: 'Ice', role: 'admin', h: 'cdf244dc85325f7545c554cdf0e8da8468bc3bc1f7f1e6dec6781945b29b00d7' },
  { key: 'kit', name: 'Kit', role: 'admin', h: '67666e672d2634f316ba9fe3a08fd58319e613c7c4d34b1b605da717d550ec17' },
  { key: 'duncan', name: 'Duncan', role: 'store', h: 'ded36397a770970b8f7341a38d1e3d2b996a65e73e3457e279bf34ee879dbb46' },
  { key: 'ray', name: 'Ray', role: 'store', h: 'd12b88538f65c71b9d9e36b8bd26fdebd62e36743d8bc8619710450b0ff1c084' },
  { key: 'abby', name: 'Abby', role: 'clerk', h: '0f3d18cff317d122e44d450743474837941084f517542dfbe33b51dfd1cbe031' },
  { key: 'nico', name: 'Nico', role: 'clerk', h: '838fb33b3691516541b0f73a4f2e45e3339e05ca15f4bf58b48197ab23c87fe9' },
  { key: '100224', name: 'Cindy Ngan', id: '100224', role: 'supervisor', h: '0d22c6c764388a3abd605d1fa7a3eb54488e7f1d095d8d7139b4d638a5bf94d8' },
  { key: '100262', name: 'Jenny Nip', id: '100262', role: 'supervisor', h: '28ebc7ad6e62edb4d1a182ffa63d65806dd645e3e0e0eaae4483876d68864c9b' },
  { key: '100266', name: 'Irene Lin', id: '100266', role: 'supervisor', h: '5f0ce240c7fbf4899ccc599c6a08d478b08ae9ae1b64203347bba4189bce3bc9' },
  { key: '100276', name: 'Cici Li', id: '100276', role: 'supervisor', h: '7b345de991f158ba70149ca22d8c253f338f0a39beaa6371cce9272252224f09' },
  { key: '100658', name: 'Linda Wu', id: '100658', role: 'supervisor', h: '768d7c2f0d5a9dc6e1c16d29a6c4bfd989c57e722a5a61067f24ecf1af96d746' },
  { key: '100662', name: 'Annie Feng', id: '100662', role: 'supervisor', h: 'c7a44e12a6378111a18cd574820cfc45444327096ec1f12ae51c27427fbb30bd' },
  { key: '100667', name: 'Bobo Zhang', id: '100667', role: 'supervisor', h: '5cfdc6cda2c6c76e89b0951c2b336cf6c3dd81c5c25c5c050dfb759061db8dda' },
  { key: '100668', name: 'Rose Zhang', id: '100668', role: 'supervisor', h: '8dfb3995f66062e343d9434d2c5576197f36514deb811f77c2369ff631d969f5' },
  { key: '100779', name: 'Ling Gong', id: '100779', role: 'supervisor', h: '50de884d930405f43bac99031082d3a16c1abbe536310f3b400efc21b4c0ad75' },
  { key: '100806', name: 'May Liu', id: '100806', role: 'supervisor', h: '21ba15073f3016d224dc81ac4f1948ad7e793f966d1168953fc91aa63ffa7c49' },
  { key: '100922', name: 'Edward Xu', id: '100922', role: 'supervisor', h: 'c4657fba0e5666f98cb1d21547e9a43af6bff7fc56c8b0833f6c0ab43941f86f' },
  { key: '101002', name: 'Anita Chou', id: '101002', role: 'supervisor', h: 'b14653c144abe2edd7f8e7f409185413360aacac94fa005dd699182d612b7e05' },
  { key: '101170', name: 'Gigi Zeng', id: '101170', role: 'supervisor', h: 'c2890a618b1fe050c98751c4a31b73c58b7ef62e82148a2b45639b776d75c4b1' },
  { key: '101488', name: 'Candy Huang', id: '101488', role: 'supervisor', h: '951941274377a29cf38ccb4b6b20302d065ab61429a2ea39b312c0077dff206f' },
  { key: '101494', name: 'Nick Su', id: '101494', role: 'supervisor', h: '8ad42d0e4eb606ef04217df374699c7532420274c0a75bdc3f7595ed3e839697' },
]

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// 以帳號名（或主管員工編號）加密碼驗證，成功回傳帳號
export async function verifyLogin(input, password) {
  const k = String(input || '').trim().toLowerCase()
  const acc = ACCOUNTS.find(a => a.key === k || a.name.toLowerCase() === k)
  if (!acc) return null
  return (await sha256(`hotel-v2:${acc.key}:${password}`)) === acc.h ? acc : null
}

const SKEY = 'hotel_session'
export const getSession = () => {
  try { const k = localStorage.getItem(SKEY); return ACCOUNTS.find(a => a.key === k) || null } catch { return null }
}
export const setSession = acc => { try { localStorage.setItem(SKEY, acc.key) } catch {} }
export const clearSession = () => { try { localStorage.removeItem(SKEY) } catch {} }
