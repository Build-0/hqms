import { useState } from 'react'
import { verifyLogin, setSession } from '../lib/accounts'

// 進入網站的帳號密碼頁（帳號：員工編號、完整英文名，或名字）
export default function Gate({ onOk }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const acc = await verifyLogin(u, p)
    setBusy(false)
    if (acc) { setSession(acc); onOk(acc) } else setErr('帳號或密碼不正確')
  }
  return (
    <div className="phone login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-logo"><img src="./icons/icon-192.png" alt="" width="64" height="64" style={{ borderRadius: 16 }} /></div>
        <h2 style={{ textAlign: 'center' }}>酒店客房管理系統</h2>
        <div className="f-row"><label>帳號</label><input value={u} onChange={e => { setU(e.target.value); setErr('') }} autoComplete="username" autoCapitalize="none" placeholder="員工編號或英文名" autoFocus /></div>
        <div className="f-row"><label>密碼</label><input type="password" value={p} onChange={e => { setP(e.target.value); setErr('') }} autoComplete="current-password" /></div>
        {err && <p className="login-err">{err}</p>}
        <button className="btn" disabled={busy || !u.trim() || !p}>{busy ? '登入中…' : '登入'}</button>
      </form>
    </div>
  )
}
