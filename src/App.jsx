import { useEffect, useState } from 'react'
import * as api from './lib/api'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Complaints from './pages/Complaints'
import Scores from './pages/Scores'
import Topics from './pages/Topics'
import CyclicClean from './pages/CyclicClean'
import Findings from './pages/Findings'
import Icon from './components/Icon'
import Embed from './components/Embed'
import Gate from './components/Gate'
import { getSession, clearSession, PERMS, ROLE_LABEL } from './lib/accounts'
import { ReportModal, BohReport, DefectReport } from './components/Reports'
import { todayStr } from './lib/dates'
import { toast } from './lib/toast'

// 首頁圓形入口：之後加新模組（清潔劑、機器…）直接在這裡加一行
const MODULES = [
  { id: 'findings', sub: '拍照記錄問題與表揚', icon: 'camera', label: '查房記錄', color: '#d07a2c', Page: Findings },
  { id: 'daily', sub: '早會題目與正確標準', icon: 'focus', label: '今日重點', color: '#1f7a6d', Page: Daily },
  { id: 'topics', sub: '分類教材與早會提問', icon: 'book', label: '培訓主題庫', color: '#4a6fa5', Page: Topics },
  { id: 'cyclic', sub: '每日、循環、深度清潔', icon: 'clean', label: '清潔要點', color: '#54808c', Page: CyclicClean },
  { id: 'scores', sub: '七項評分與報告', icon: 'star', label: '房務員清潔評分', color: '#8f7ac9', Page: Scores },
  // 嵌入的舊系統（與品質系統同網站、各自保留原有資料庫）
  { id: 'boh', icon: 'box', label: '後勤管理', color: '#7a6a4f', embed: true, Page: ({ session }) => <Embed src={`./boh/index.html?edit=${session && PERMS[session.role].boh !== 'edit' ? 0 : 1}`} title="酒店後勤管理" /> },
  { id: 'defect', icon: 'wrench', label: '缺陷管理', color: '#b5603a', embed: true, Page: ({ session }) => <Embed src={`./defect/index.html?role=${session && PERMS[session.role].defect === 'edit' ? 'admin' : session ? 'supervisor' : 'admin'}&uid=${encodeURIComponent(session ? (session.id || session.name) : 'admin')}&uname=${encodeURIComponent(session ? session.name : '管理員')}`} title="房間缺陷登記" /> },
  { id: 'complaint', sub: '記錄、統計與月報', icon: 'chat', label: '客訴管理', color: '#c0564f', Page: Complaints },
]
// 首頁三大系統卡：房間品質（內含上面各模組）／後勤管理（嵌入）／缺陷管理（待加入）
const SYSTEMS = [
  { id: 'quality', icon: 'clipcheck', label: '房間品質', sub: '檢查、評分、報告', color: '#1f7a6d' },
  { id: 'boh', icon: 'box', label: '後勤管理', sub: '物資、庫存、設備', color: '#4a6fa5' },
  { id: 'defect', icon: 'wrench', label: '缺陷管理', sub: '登記、跟進、統計', color: '#c0564f' },
]
const WD = ['日', '一', '二', '三', '四', '五', '六']

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = 載入中
  const [tab, setTab] = useState('home')
  const [msg, setMsg] = useState('')
  const [session, setSessionState] = useState(() => (api.isOpen ? getSession() : null))
  const [rpt, setRpt] = useState(null)   // 嵌入模組的匯出報告 {id, data}

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

  // 任何沒被接住的儲存／載入錯誤都提示出來，避免按了沒反應
  useEffect(() => {
    const fn = e => { toast('操作失敗：' + (e.reason?.message || e.reason || '未知錯誤')); e.preventDefault() }
    window.addEventListener('unhandledrejection', fn)
    return () => window.removeEventListener('unhandledrejection', fn)
  }, [])

  if (api.isOpen && !session) return <Gate onOk={setSessionState} />
  api.setReadOnly(!!session && PERMS[session.role].quality !== 'edit')
  if (user === undefined) return null
  if (!user) return <Login onLogin={setUser} />

  const now = new Date()
  const cur = MODULES.find(m => m.id === tab)
  const inQuality = tab === 'quality'
  const exportEmbed = () => {
    const w = document.querySelector('iframe.embed-frame')?.contentWindow
    const data = w && w.__getReport && w.__getReport()
    if (!data) { toast(cur.id === 'defect' ? '請先登入缺陷系統，並等資料載入完成' : '資料尚未載入完成，請稍後再試'); return }
    setRpt({ id: cur.id, data })
  }
  const goBack = () => setTab(cur && !cur.embed ? 'quality' : 'home')
  const title = cur ? cur.label : inQuality ? '房間品質' : '酒店客房管理系統'
  return (
    <div className={`phone ${session && PERMS[session.role].quality !== 'edit' && (inQuality || (cur && !cur.embed)) ? 'ro' : ''}`}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(cur || inQuality) && <button className="back-btn" onClick={cur ? goBack : () => setTab('home')}>‹</button>}
          {cur && <span className="hdr-ico" style={{ background: 'rgba(255,255,255,.2)' }}><Icon name={cur.icon} size={18} color="#fff" /></span>}
          <h1 style={{ flex: 1 }}>{title}</h1>
          {cur?.embed && <button className="logout" onClick={exportEmbed}>📄 匯出</button>}
          {api.isOpen
            ? <button className="logout" onClick={() => { clearSession(); setTab('home'); setSessionState(null) }}>登出</button>
            : <button className="logout" onClick={async () => { await api.signOut(); setUser(null) }}>登出</button>}
        </div>
        <div className="date">
          {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日（星期{WD[now.getDay()]}）
          {api.isLocal && ' · 示範模式'}{session && ` · ${session.name}（${ROLE_LABEL[session.role]}）`}
          <span style={{ opacity: .6 }}> · 版本 {__BUILD__}</span>
        </div>
      </header>
      <main className={cur?.embed ? 'embed-main' : ''}>
        {cur ? <cur.Page key={tab} session={session} /> : inQuality ? (
          <div className="home-grid">
            {MODULES.filter(m => !m.embed).map(m => (
              <button className="home-item" key={m.id} onClick={() => setTab(m.id)}>
                <span className="hi-circle" style={{ background: m.color + '26', borderColor: 'transparent' }}><Icon name={m.icon} size={33} color={m.color} width={2.2} /></span>
                <span className="hi-label">{m.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sys-home">
            <div className="sys-grid">
              {SYSTEMS.map(sy => (
                <button className="sys-card" key={sy.id} onClick={() => setTab(sy.id)}>
                  <Icon name={sy.icon} size={30} color="var(--ink)" width={1.9} />
                  <b>{sy.label}</b>
                  <span>{sy.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
      {rpt && (
        <ReportModal title={rpt.id === 'boh' ? '後勤管理報告' : '缺陷管理報告'} sub={todayStr()} onClose={() => setRpt(null)}>
          {rpt.id === 'boh' ? <BohReport data={rpt.data} /> : <DefectReport data={rpt.data} />}
        </ReportModal>
      )}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
