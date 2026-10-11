import { useEffect, useState } from 'react'
import * as api from './lib/api'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Complaints from './pages/Complaints'
import Topics from './pages/Topics'
import CyclicClean from './pages/CyclicClean'
import Defects from './pages/Defects'
import Boh from './pages/Boh'
import Home from './pages/Home'
import Findings from './pages/Findings'
import Icon from './components/Icon'
import Embed from './components/Embed'
import Gate from './components/Gate'
import Confirm from './components/Confirm'
import { getSession, clearSession, PERMS, ROLE_LABEL } from './lib/accounts'
import { ReportModal, BohReport, DefectReport } from './components/Reports'
import { todayStr } from './lib/dates'
import { toast } from './lib/toast'

// 首頁圓形入口：之後加新模組（清潔劑、機器…）直接在這裡加一行
const MODULES = [
  { id: 'findings', sub: '問題、表揚與人員表現', icon: 'camera', label: '查房記錄', color: '#d07a2c', Page: Findings },
  { id: 'daily', sub: '早會題目與正確標準', icon: 'focus', label: '今日重點', color: '#1f7a6d', Page: Daily },
  { id: 'topics', sub: '分類教材與早會提問', icon: 'book', label: '培訓主題庫', color: '#4a6fa5', Page: Topics },
  { id: 'cyclic', sub: '每日、循環、深度清潔', icon: 'clean', label: '清潔要點', color: '#54808c', Page: CyclicClean },
  // 嵌入的舊系統（與品質系統同網站、各自保留原有資料庫）
  { id: 'boh', icon: 'box', label: '後勤管理', color: '#7a6a4f', top: true, Page: Boh },
  { id: 'defect', icon: 'wrench', label: '缺陷管理', color: '#b5603a', top: true, Page: Defects },
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
  const [init, setInit] = useState(null)   // 從首頁摘要跳入時的預設篩選
  const go = (t, i) => { setInit(i || null); setTab(t) }
  const [refreshing, setRefreshing] = useState(false)  // 刷新中（轉圈）
  const [rk, setRk] = useState(0)                        // 刷新計數：改變即重新載入目前頁面資料
  const [newVer, setNewVer] = useState(false)       // 偵測到新版本
  const [askLogout, setAskLogout] = useState(false)   // 登出前確認，避免撳錯
  const [rpt, setRpt] = useState(null)   // 嵌入模組的匯出報告 {id, data}

  useEffect(() => {
    api.getUser().then(setUser)
    return api.onAuthChange(setUser)
  }, [])

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (j.build && j.build !== __BUILD__) setNewVer(true)
      } catch { /* 離線或開發模式：略過 */ }
    }
    check()
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
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
  const locked = id => !!session && (PERMS[session.role][id] || 'none') === 'none'
  // 即使被封鎖的頁面（例如舊分頁狀態）也一律退回首頁
  if (tab !== 'home' && session && (((cur && cur.id === 'boh') && locked('boh')) || ((cur && cur.id === 'defect') && locked('defect')) || ((tab === 'quality' || (cur && !cur.embed && !cur.top)) && locked('quality')))) setTimeout(() => setTab('home'), 0)
  const hardReload = () => { location.href = location.pathname + '?v=' + Date.now() }
  async function doRefresh() {
    if (refreshing) return
    setRefreshing(true)
    const t0 = Date.now()
    try {
      const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
      if (r.ok) { const j = await r.json(); if (j.build && j.build !== __BUILD__) { hardReload(); return } }
    } catch { /* 離線：只重新載入資料 */ }
    setRk(k => k + 1)
    await new Promise(r => setTimeout(r, Math.max(0, 800 - (Date.now() - t0))))
    setRefreshing(false)
  }
  const exportEmbed = () => {
    const w = document.querySelector('iframe.embed-frame')?.contentWindow
    const data = w && w.__getReport && w.__getReport()
    if (!data) { toast(cur.id === 'defect' ? '請先登入缺陷系統，並等資料載入完成' : '資料尚未載入完成，請稍後再試'); return }
    setRpt({ id: cur.id, data })
  }
  const goBack = () => setTab(cur && !cur.embed && !cur.top ? 'quality' : 'home')
  const title = cur ? cur.label : inQuality ? '房間品質' : '酒店客房管理系統'
  return (
    <div className={`phone ${session && PERMS[session.role].quality !== 'edit' && (inQuality || (cur && !cur.embed && !cur.top)) ? 'ro' : ''}`}>
      <header className={tab === 'home' ? 'hdr-home' : ''}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(cur || inQuality) && <button className="back-btn" onClick={cur ? goBack : () => setTab('home')}>‹</button>}
          {cur && <span className="hdr-ico" style={{ background: 'rgba(255,255,255,.2)' }}><Icon name={cur.icon} size={18} color="#fff" /></span>}
          <h1 style={{ flex: 1 }}>{title}</h1>
          {cur?.embed && <button className="logout" onClick={exportEmbed}>📄 匯出</button>}
          <button className={`logout refresh ${refreshing ? 'spin' : ''}`} onClick={doRefresh} aria-label="刷新">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>
            <span>{refreshing ? '更新中…' : '刷新'}</span>
          </button>
          <button className="logout" onClick={() => setAskLogout(true)}>登出</button>
        </div>
        {tab === 'home' && (
          <div className="hdr-sub">
            <span className="hdr-date">{now.getMonth() + 1}月{now.getDate()}日　星期{WD[now.getDay()]}</span>
            {api.isLocal && <span className="hdr-user">示範模式</span>}
            {session && <span className="hdr-user">{session.name} · {ROLE_LABEL[session.role]}</span>}
          </div>
        )}
      </header>
      <main className={cur?.embed ? 'embed-main' : ''}>
        {cur ? <cur.Page key={tab + ':' + rk} session={session} init={init} /> : inQuality ? (
          <div className="home-grid">
            {MODULES.filter(m => !m.embed && !m.top).map(m => (
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
                <button className={`sys-card ${locked(sy.id) ? 'locked' : ''}`} key={sy.id} onClick={() => (locked(sy.id) ? toast('此帳號沒有權限進入「' + sy.label + '」') : go(sy.id))}>
                  <Icon name={sy.icon} size={30} color="var(--ink)" width={1.9} />
                  <b>{sy.label}</b>
                  <span>{sy.sub}</span>
                  {locked(sy.id) && <i>🔒 無權限</i>}
                </button>
              ))}
            </div>
            <Home key={rk} session={session} go={go} />
            <div className="ver-line">版本 {__BUILD__}</div>
          </div>
        )}
      </main>
      {newVer && <button className="newver" onClick={hardReload}>🔄 有新版本，撳此更新</button>}
      {askLogout && (
        <Confirm confirmLabel="登出" text={session ? `會登出「${session.name}」，之後要重新輸入密碼先可以再用。` : '會登出目前帳號。'}
          onCancel={() => setAskLogout(false)}
          onConfirm={async () => {
            setAskLogout(false)
            if (api.isOpen) { clearSession(); setTab('home'); setSessionState(null) } else { await api.signOut(); setUser(null) }
          }} />
      )}
      {rpt && (
        <ReportModal title={rpt.id === 'boh' ? '後勤管理報告' : '缺陷管理報告'} sub={todayStr()} onClose={() => setRpt(null)}>
          {rpt.id === 'boh' ? <BohReport data={rpt.data} /> : <DefectReport data={rpt.data} />}
        </ReportModal>
      )}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
