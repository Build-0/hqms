import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'

// 開發者專用：睇每個帳號幾時用過、用咗幾多次、停留幾耐
const fmtT = s => {
  s = Math.round(s || 0)
  if (s < 60) return s + ' 秒'
  if (s < 3600) return Math.round(s / 60) + ' 分鐘'
  return (s / 3600).toFixed(1) + ' 小時'
}
const fmtD = t => {
  if (!t) return '—'
  const d = new Date(t)
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Macau', day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Macau', hour: '2-digit', minute: '2-digit' })
}
const ago = t => {
  if (!t) return ''
  const d = Math.floor((Date.now() - new Date(t).getTime()) / 86400000)
  return d <= 0 ? '今日' : d + ' 日前'
}
const lastOf = r => r.last_seen || r.last_sign_in

export default function UsageAdmin({ onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [sort, setSort] = useState('last')
  const [open, setOpen] = useState(null)
  const [recent, setRecent] = useState([])
  useEffect(() => { api.usageSummary().then(setRows).catch(ex => { setErr(ex.message); setRows([]) }) }, [])
  const list = useMemo(() => {
    const a = [...(rows || [])]
    const key = { last: r => -(lastOf(r) ? new Date(lastOf(r)).getTime() : 0), time: r => -r.total_seconds, visits: r => -r.visits, days: r => -r.days_active }[sort]
    return a.sort((x, y) => key(x) - key(y))
  }, [rows, sort])
  const never = list.filter(r => !r.visits && !r.last_sign_in)
  const since = rows && rows.reduce((m, r) => (r.first_seen && (!m || r.first_seen < m) ? r.first_seen : m), null)
  const show = r => {
    if (open === r.emp_id) { setOpen(null); return }
    setOpen(r.emp_id); setRecent([])
    api.usageRecent(r.emp_id).then(setRecent).catch(() => {})
  }

  return (
    <div className="modal pm-modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet pm-sheet">
        <div className="sheet-hd"><h2>使用記錄（開發者）</h2><span className="sheet-hd-acts"><button className="mini pri" onClick={onClose}>關閉</button></span></div>
        <p className="src-note" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
          只有開發者睇到。時間為澳門時間。精確嘅「到訪次數／停留時間」由呢個功能上線後開始記{since ? `（最早一筆：${fmtD(since)}）` : ''}；上線之前只可以睇到「最後登入」。撳一個人可以睇佢最近嘅到訪。
        </p>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13 }}>讀取失敗：{err}</p></div>}
        {!rows && <p className="src-note">載入中…</p>}
        {rows && (
          <>
            <div className="chips" style={{ marginBottom: 8 }}>
              {[['last', '最近使用'], ['time', '停留最長'], ['visits', '次數最多'], ['days', '日數最多']].map(([k, l]) => <button key={k} className={`chip ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>{l}</button>)}
            </div>
            {never.length > 0 && <div className="card" style={{ marginBottom: 8 }}><p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>⚠️ <b>從未登入（{never.length}）</b>：{never.map(r => r.name).join('、')}</p></div>}
            {list.map(r => (
              <div className="pm-row" key={r.emp_id} onClick={() => show(r)} style={{ cursor: 'pointer' }}>
                <div className="pm-top"><b>{r.name}</b><span>{r.emp_id}</span></div>
                <div style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--sub)' }}>
                  最近：<b style={{ color: 'var(--ink)' }}>{fmtD(lastOf(r))}</b> {lastOf(r) ? `（${ago(lastOf(r))}${r.last_seen ? '' : '·只知登入'}）` : '（從未）'}<br />
                  到訪 <b>{r.visits}</b> 次 · 用過 <b>{r.days_active}</b> 日 · 總停留 <b>{fmtT(r.total_seconds)}</b> · 近 7 日 <b>{fmtT(r.secs_7d)}</b>
                </div>
                {open === r.emp_id && (
                  <div style={{ marginTop: 6, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                    {recent.length ? recent.map(v => (
                      <div key={v.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                        <span>{fmtD(v.started_at)}</span><span>{fmtT(v.seconds)}</span>
                      </div>
                    )) : <span style={{ fontSize: 12, color: 'var(--sub)' }}>未有到訪記錄</span>}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
