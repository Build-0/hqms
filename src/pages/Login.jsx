import { useState } from 'react'
import * as api from '../lib/api'

export default function Login({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      onLogin(await api.signIn(u.trim(), p))
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="phone login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-logo">🏨</div>
        <h2 style={{ textAlign: 'center' }}>房務品質管理系統</h2>
        {api.isLocal && (
          <p className="login-hint">示範模式（未連接資料庫）<br />輸入任意帳號即可進入，資料只存在此瀏覽器</p>
        )}
        <div className="f-row">
          <label>帳號</label>
          <input value={u} onChange={e => setU(e.target.value)} autoComplete="username" autoFocus />
        </div>
        <div className="f-row">
          <label>密碼</label>
          <input type="password" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <p className="login-err">{err}</p>}
        <button className="btn" disabled={busy || !u.trim()}>{busy ? '登入中…' : '登入'}</button>
      </form>
    </div>
  )
}
