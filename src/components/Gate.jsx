import { useState } from 'react'

// 進入網站的帳號密碼閘。只存雜湊（不放明文）；這是前端閘門，不等於資料庫權限。
const HASH = '663e0a1b15cb5a9c9ed21452e43a5d58fe6023e2f9f26227e2f77d8ab1937b42'
const KEY = 'hotel_gate_ok'
export const gatePassed = () => { try { return localStorage.getItem(KEY) === HASH } catch { return false } }
export const gateLogout = () => { try { localStorage.removeItem(KEY) } catch {} }

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function Gate({ onOk }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    const h = await sha256('hotel-gate-v1:' + u.trim().toLowerCase() + ':' + p)
    if (h === HASH) { try { localStorage.setItem(KEY, HASH) } catch {} onOk() } else setErr('帳號或密碼不正確')
  }
  return (
    <div className="phone login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-logo">🏨</div>
        <h2 style={{ textAlign: 'center' }}>酒店客房管理系統</h2>
        <div className="f-row"><label>帳號</label><input value={u} onChange={e => setU(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus /></div>
        <div className="f-row"><label>密碼</label><input type="password" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" /></div>
        {err && <p className="login-err">{err}</p>}
        <button className="btn" disabled={!u.trim() || !p}>登入</button>
      </form>
    </div>
  )
}
