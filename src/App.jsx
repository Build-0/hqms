import { useEffect, useState } from 'react'
import * as api from './lib/api'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Complaints from './pages/Complaints'
import Scores from './pages/Scores'
import Topics from './pages/Topics'
import Training from './pages/Training'
import CyclicClean from './pages/CyclicClean'
import Icon from './components/Icon'

// 首頁圓形入口：之後加新模組（清潔劑、機器…）直接在這裡加一行
const MODULES = [
  { id: 'daily', icon: 'focus', label: '今日重點', color: '#1f7a6d', Page: Daily },
  { id: 'complaint', icon: 'chat', label: '客訴管理', color: '#c0564f', Page: Complaints },
  { id: 'topics', icon: 'book', label: '主題庫', color: '#4a6fa5', Page: Topics },
  { id: 'training', icon: 'cap', label: '新人教材', color: '#b07d2e', Page: Training },
  { id: 'cyclic', icon: 'clean', label: '衛生與整潔', color: '#54808c', Page: CyclicClean },
  { id: 'scores', icon: 'star', label: '清潔評分', color: '#8f7ac9', Page: Scores },
]
const WD = ['日', '一', '二', '三', '四', '五', '六']

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = 載入中
  const [tab, setTab] = useState('home')
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
  const cur = MODULES.find(m => m.id === tab)
  return (
    <div className="phone">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {cur && <button className="back-btn" onClick={() => setTab('home')}>‹</button>}
          {cur && <span className="hdr-ico" style={{ background: 'rgba(255,255,255,.2)' }}><Icon name={cur.icon} size={18} color="#fff" /></span>}
          <h1 style={{ flex: 1 }}>{cur ? cur.label : '房務品質管理系統'}</h1>
          {!api.isOpen && <button className="logout" onClick={async () => { await api.signOut(); setUser(null) }}>登出</button>}
        </div>
        <div className="date">
          {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日（星期{WD[now.getDay()]}）
          {api.isLocal && ' · 示範模式'}{api.isOpen && ' · 開放模式'}
        </div>
      </header>
      <main>
        {cur
          ? <cur.Page key={tab} />
          : (
            <div className="home-grid">
              {MODULES.map(m => (
                <button className="home-item" key={m.id} onClick={() => setTab(m.id)}>
                  <span className="hi-circle" style={{ background: m.color + '26', borderColor: 'transparent' }}><Icon name={m.icon} size={33} color={m.color} width={2.2} /></span>
                  <span className="hi-label">{m.label}</span>
                </button>
              ))}
            </div>
          )}
      </main>
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
