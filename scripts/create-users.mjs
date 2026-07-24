// 批量建立同事帳號（用 Supabase Admin API，等同 Dashboard 手動 Add user + Auto Confirm）
//
// 用法（PowerShell，在 hqms 資料夾）：
//   $env:SUPABASE_URL = 'https://你的專案.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = 'Dashboard → Settings → API 的 service_role key'
//   node scripts/create-users.mjs amy:密碼123 ben:密碼456 mary:密碼789
//
// 帳號會自動補成 amy@hqms.local；同事登入時只需輸入 amy + 密碼。
// service_role key 是最高權限金鑰，只在自己電腦用，不要貼給任何人或放進程式碼。
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const pairs = process.argv.slice(2)

if (!url || !key || !pairs.length) {
  console.log('缺少設定。請先設定 $env:SUPABASE_URL 和 $env:SUPABASE_SERVICE_ROLE_KEY，')
  console.log('然後執行：node scripts/create-users.mjs 名字:密碼 名字:密碼 ...')
  process.exit(1)
}

const sb = createClient(url, key)
for (const p of pairs) {
  const i = p.indexOf(':')
  if (i < 1) { console.log(`✗ 格式錯誤（要 名字:密碼）：${p}`); continue }
  const name = p.slice(0, i)
  const password = p.slice(i + 1)
  const email = name.includes('@') ? name : `${name}@hqms.local`
  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
  console.log(error ? `✗ ${email}：${error.message}` : `✓ ${email} 已建立`)
}
