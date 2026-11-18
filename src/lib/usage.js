import * as api from './api'

// 記錄使用時間：登入後每次開網頁記一筆「到訪」，畫面喺前台時每 20 秒累加停留時間
let cur = null
export function startUsage(empId) {
  if (cur && cur.emp === empId) return () => {}
  const s = { emp: empId, id: null, secs: 0, timer: null, last: Date.now() }
  cur = s
  api.usageStart(empId).then(id => { s.id = id })
  const tick = () => {
    const now = Date.now()
    if (document.visibilityState === 'visible') s.secs += Math.min(60, Math.round((now - s.last) / 1000))
    s.last = now
    if (s.id) api.usageBeat(s.id, s.secs).catch(() => {})
  }
  s.timer = setInterval(tick, 20000)
  document.addEventListener('visibilitychange', tick)
  return () => { clearInterval(s.timer); document.removeEventListener('visibilitychange', tick); if (cur === s) cur = null }
}
