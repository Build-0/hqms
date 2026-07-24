import { useEffect, useState } from 'react'
import * as api from './lib/api'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Complaints from './pages/Complaints'
import Topics from './pages/Topics'
import Training from './pages/Training'

const TABS = [
  { id: 'daily', ico: '📌', label: '今日重點', Page: Daily },
  { id: 'complaint', ico: '📋', label: '客訴管理', Page: Complaints },
  { id: 'topics', ico: '📚', label: '主題庫', Page: Topics },
  { id: 'training', ico: '🎓', label: '新人教材', Page: Training },
]
const WD = ['日', '一', '二', '三', '四', '五', '六']

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = 載入中
  const [tab, setTab] = useState('daily')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.getUser().then(setUser)
    return api.onAuthChange(setUser)
  }, [])

  useEffect(() => {
    let h
    const fn = e => {
      setMsg(e.detail)
      clearTimeout(h)
      h = setTimeout(() => setMsg(''), 2200)
    }
    window.addEventListener('hqms-toast', fn)
    return () => { window.removeEventListener('hqms-toast', fn); clearTimeout(h) }
  }, [])

  if (user === undefined) return null
  if (!user) return <Login onLogin={setUser} />

  const now = new Date()
  const { Page } = TABS.find(t => t.id === tab)
  return (
    <div className="phone">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>房務品質管理系統</h1>
          <button className="logout" onClick={async () => { await api.signOut(); setUser(null) }}>登出</button>
        </div>
        <div className="date">
          {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日（星期{WD[now.getDay()]}）
          {api.isLocal && ' · 示範模式'}
        </div>
      </header>
      <main>
        <Page key={tab} />
      </main>
      <nav>
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ico">{t.ico}</span>{t.label}
          </button>
        ))}
      </nav>
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
