import { useEffect, useState } from 'react'
import * as api from './lib/api'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Complaints from './pages/Complaints'
import Scores from './pages/Scores'
import Topics from './pages/Topics'
import Training from './pages/Training'

// secondary: 手機收進「更多」面板；電腦側欄全部直接顯示。之後加新模組放這裡即可。
const TABS = [
  { id: 'daily', ico: '📌', label: '今日重點', Page: Daily },
  { id: 'complaint', ico: '📋', label: '客訴管理', Page: Complaints },
  { id: 'topics', ico: '📚', label: '主題庫', Page: Topics },
  { id: 'training', ico: '🎓', label: '新人教材', Page: Training, secondary: true },
  { id: 'scores', ico: '⭐', label: '清潔評分', Page: Scores, secondary: true },
]
const WD = ['日', '一', '二', '三', '四', '五', '六']

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = 載入中
  const [tab, setTab] = useState('daily')
  const [more, setMore] = useState(false)
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
  const cur = TABS.find(t => t.id === tab)
  const { Page } = cur
  return (
    <div className="phone">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>房務品質管理系統</h1>
          {!api.isOpen && <button className="logout" onClick={async () => { await api.signOut(); setUser(null) }}>登出</button>}
        </div>
        <div className="date">
          {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日（星期{WD[now.getDay()]}）
          {api.isLocal && ' · 示範模式'}{api.isOpen && ' · 開放模式'}
        </div>
      </header>
      <main>
        <Page key={tab} />
      </main>
      <nav>
        <div className="brand">🏨 房務品質系統</div>
        {TABS.map(t => (
          <button key={t.id} className={`${tab === t.id ? 'on' : ''} ${t.secondary ? 'sec' : ''}`}
            onClick={() => { setTab(t.id); setMore(false) }}>
            <span className="ico">{t.ico}</span>{t.label}
          </button>
        ))}
        <button className={`more-btn ${cur.secondary ? 'on' : ''}`} onClick={() => setMore(true)}>
          <span className="ico">⋯</span>更多
        </button>
      </nav>
      {more && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setMore(false) }}>
          <div className="sheet">
            <h2>更多功能</h2>
            <div className="more-grid">
              {TABS.filter(t => t.secondary).map(t => (
                <button key={t.id} className={`more-item ${tab === t.id ? 'on' : ''}`}
                  onClick={() => { setTab(t.id); setMore(false) }}>
                  <span className="mi-ico">{t.ico}</span>{t.label}
                </button>
              ))}
            </div>
            <button className="btn ghost" onClick={() => setMore(false)}>關閉</button>
          </div>
        </div>
      )}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
