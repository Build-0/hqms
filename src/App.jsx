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
import PublicAreas from './pages/PublicAreas'
import { runBack } from './lib/nav'
import Confirm from './components/Confirm'
import { getSession, clearSession, applyOverride, permsOf, itemLevel, ITEMS, ROLE_LABEL } from './lib/accounts'
import PermAdmin from './components/PermAdmin'
import UniformPage from './pages/UniformPage'
import WriteOffPage from './pages/WriteOffPage'
import RoomSalePage from './pages/RoomSalePage'
import { toast } from './lib/toast'

// 首頁圓形入口：之後加新模組（清潔劑、機器…）直接在這裡加一行
const MODULES = [
  { id: 'daily', sub: '早會題目與正確標準', icon: 'focus', label: '今日重點', color: '#1f7a6d', Page: Daily },
  { id: 'findings', sub: '問題、表揚與人員表現', icon: 'camera', label: '查房記錄', color: '#d07a2c', Page: Findings },
  { id: 'topics', sub: '分類教材與正確做法', icon: 'book', label: '培訓主題庫', color: '#4a6fa5', Page: Topics },
  { id: 'cyclic', sub: '每日、循環、深度清潔', icon: 'clean', label: '清潔要點', color: '#54808c', Page: CyclicClean },
  { id: 'public', sub: '崗位、看板、任務、員工', icon: 'people', label: '公共地區', color: '#8a6d3b', top: true, Page: PublicAreas },
  // 嵌入的舊系統（與品質系統同網站、各自保留原有資料庫）
  { id: 'boh', icon: 'box', label: '後勤管理', color: '#7a6a4f', top: true, Page: Boh },
  { id: 'defect', icon: 'wrench', label: '缺陷管理', color: '#b5603a', top: true, Page: Defects },
  { id: 'uniform', sub: '制服庫存', icon: 'shirt', label: '制服布草管理', color: '#8f7ac9', top: true, dev: true, Page: UniformPage },
  { id: 'writeoff', sub: '報銷、遺失、狀態跟進', icon: 'search', label: '報銷與遺失管理', color: '#c0564f', top: true, dev: true, Page: WriteOffPage },
  { id: 'roomsale', sub: '價錢、庫存', icon: 'tag', label: '房間可售物品', color: '#2f8f9d', top: true, dev: true, Page: RoomSalePage },
  { id: 'complaint', sub: '記錄、統計與月報', icon: 'chat', label: '客訴管理', color: '#c0564f', Page: Complaints },
]
// 首頁三大系統卡：房間品質（內含上面各模組）／後勤管理（嵌入）／缺陷管理（待加入）
const SYSTEMS = [
  { id: 'quality', icon: 'clipcheck', label: '房間品質', sub: '檢查、評分、報告', color: '#1f7a6d' },
  { id: 'boh', icon: 'box', label: '後勤管理', sub: '物資、庫存、設備', color: '#4a6fa5' },
  { id: 'defect', icon: 'wrench', label: '缺陷管理', sub: '登記、跟進、統計', color: '#c0564f' },
  { id: 'public', icon: 'people', label: '公共地區', sub: '崗位、看板、員工', color: '#8a6d3b' },
  { id: 'uniform', icon: 'shirt', label: '制服布草管理', sub: '制服庫存', color: '#8f7ac9', dev: true },
  { id: 'writeoff', icon: 'search', label: '報銷與遺失管理', sub: '報銷、遺失、跟進', color: '#c0564f', dev: true },
  { id: 'roomsale', icon: 'tag', label: '房間可售物品', sub: '價錢／庫存表', color: '#2f8f9d', dev: true },
]
const WD = ['日', '一', '二', '三', '四', '五', '六']

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = 載入中
  const [tab, setTab] = useState('home')
  const [msg, setMsg] = useState('')
  const [session, setSessionState] = useState(() => (api.isOpen ? getSession() : null))
  const [init, setInit] = useState(null)   // 從首頁摘要跳入時的預設篩選
  const go = (t, i) => { setInit(i || null); setTab(t) }
  // 大字版：長者或視力較弱的同事可以放大整個介面，記住選擇
  const [paEn, setPaEn] = useState(() => { try { return localStorage.getItem('pa_lang') === 'en' } catch { return false } })
  const setPaLang = v => { setPaEn(v); try { localStorage.setItem('pa_lang', v ? 'en' : 'zh') } catch { /* 無法儲存時照常使用 */ } window.dispatchEvent(new Event('pa-lang')) }
  const [big, setBig] = useState(() => { try { return localStorage.getItem('hotel_big') === '1' } catch { return false } })
  useEffect(() => {
    document.documentElement.classList.toggle('big', big)
    try { localStorage.setItem('hotel_big', big ? '1' : '0') } catch { /* 無法儲存時照常使用 */ }
  }, [big])
  const [moreOpen, setMoreOpen] = useState(false)   // 底部導覽「更多」
  const [permOpen, setPermOpen] = useState(false)   // 權限管理（開發者）
  const [settings, setSettings] = useState(false)   // 設定面板（大字、刷新、登出）
  const [refreshing, setRefreshing] = useState(false)  // 刷新中（轉圈）
  const [rk, setRk] = useState(0)                        // 刷新計數：改變即重新載入目前頁面資料
  const [newVer, setNewVer] = useState(false)       // 偵測到新版本
  const [askLogout, setAskLogout] = useState(false)   // 登出前確認，避免點錯

  // 員工帳號：登入狀態失效（過期／被登出）就回登入頁
  useEffect(() => {
    if (!api.isOpen) return
    api.hasAuth().then(ok => { if (!ok) { clearSession(); setSessionState(null) } })
    return api.onSignedOut(() => { clearSession(); setSessionState(null) })
  }, [])
  // 以資料庫內嘅角色／旗標為準（開發者可以喺權限管理改），登入後同步到畫面
  useEffect(() => {
    if (!api.isOpen || !session) return undefined
    let on = true
    Promise.all([api.myStaff(), api.myItems().catch(() => ({}))]).then(([r, items]) => {
      if (!on || !r) return
      const f = { role: r.role, pub: !!r.pub_sup, dev: !!r.is_dev, items }
      if (session.role === f.role && !!session.pub === f.pub && !!session.dev === f.dev && JSON.stringify(session.items || {}) === JSON.stringify(items)) return
      applyOverride(session.key, f); setSessionState(getSession())
    }).catch(() => {})
    return () => { on = false }
  }, [session && session.key])
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

  if (api.isOpen && !session) return <Gate onOk={setSessionState} big={big} onBig={() => setBig(b => !b)} />
  const cur0 = MODULES.find(m => m.id === tab)
  api.setReadOnly(!!session && (cur0 ? (cur0.id !== 'public' && itemLevel(session, cur0.id) !== 'edit') : permsOf(session).quality !== 'edit'))
  if (user === undefined) return null
  if (!user) return <Login onLogin={setUser} />

  const now = new Date()
  const cur = MODULES.find(m => m.id === tab)
  const inQuality = tab === 'quality'
  // 房間品質：有「品質」權限或「查房記錄」權限（樓層主管）都可進入；樓層主管進去只見查房記錄
  const lvl = id => itemLevel(session, id)
  const showSys = sy => !sy.dev || lvl(sy.id) !== 'none' || (!!session && session.role === 'admin')
  const qMods = MODULES.filter(m => !m.embed && !m.top)
  const locked = id => !!session && (id === 'public' ? ITEMS.filter(i => i.id.startsWith('pa_')).every(i => lvl(i.id) === 'none') : id === 'quality' ? qMods.every(m => lvl(m.id) === 'none') : lvl(id) === 'none')
  // 即使被封鎖的頁面（例如舊分頁狀態）也一律退回首頁
  if (tab !== 'home' && session && (((cur && cur.id === 'boh') && locked('boh')) || ((cur && cur.id === 'defect') && locked('defect')) || ((cur && cur.id === 'public') && locked('public')) || ((cur && cur.id === 'uniform') && locked('uniform')) || ((cur && cur.id === 'writeoff') && locked('writeoff')) || ((cur && cur.id === 'roomsale') && locked('roomsale')) || ((tab === 'quality' || (cur && !cur.embed && !cur.top)) && locked('quality')))) setTimeout(() => setTab('home'), 0)
  // 只有查房記錄權限（樓層主管）的帳號：其他品質模組一律退回首頁
  if (session && cur && !cur.embed && !cur.top && lvl(cur.id) === 'none') setTimeout(() => setTab('home'), 0)
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
  const goBack = () => setTab(cur && !cur.embed && !cur.top ? 'quality' : 'home')
  const title = cur ? cur.label : inQuality ? '房間品質' : '客房公區管理系統'
  return (
    <div className={`phone ${session && cur && !cur.embed && !cur.top && lvl(cur.id) !== 'edit' && lvl(cur.id) !== 'add' ? 'ro' : ''}`}>
      <header className={tab === 'home' ? 'hdr-home' : ''}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(cur || inQuality) && <button className="back-btn" onClick={() => { if (!runBack()) { cur ? goBack() : setTab('home') } }}>‹</button>}
          {cur && <span className="hdr-ico" style={{ background: 'rgba(255,255,255,.2)' }}><Icon name={cur.icon} size={18} color="#fff" /></span>}
          <h1 style={{ flex: 1 }}>{title}</h1>
          <button className="hdr-gear" onClick={() => setSettings(true)} aria-label="設定"><Icon name="gear" size={26} color="#fff" width={2} /></button>
        </div>
        {tab === 'home' && (
          <div className="hdr-sub">
            <span className="hdr-date">{now.getMonth() + 1}月{now.getDate()}日　星期{WD[now.getDay()]}</span>
            {api.isLocal && <span className="hdr-user">示範模式</span>}
            {session && <span className="hdr-user">{session.name} · {session.dev ? '開發者' : ROLE_LABEL[session.role]}</span>}
          </div>
        )}
      </header>
      <main className={cur?.embed ? 'embed-main' : ''}>
        {cur ? <cur.Page key={tab + ':' + rk} session={session} init={init} /> : inQuality ? (
          <div className="home-grid">
            {qMods.filter(m => lvl(m.id) !== 'none').map(m => (
              <button className="home-item" key={m.id} onClick={() => setTab(m.id)}>
                <span className="hi-circle" style={{ background: m.color + '26', borderColor: 'transparent' }}><Icon name={m.icon} size={33} color={m.color} width={2.2} /></span>
                <span className="hi-label">{m.label}</span>
                <span className="hi-sub">{m.sub}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sys-home">
            <div className="sys-grid">
              {SYSTEMS.filter(sy => showSys(sy)).map(sy => (
                <button className={`sys-card ${locked(sy.id) ? 'locked' : ''}`} key={sy.id} onClick={() => (locked(sy.id) ? toast(sy.wip ? '開發中，暫時未開放' : '此帳號沒有權限進入「' + sy.label + '」') : go(sy.id))}>
                  <Icon name={sy.icon} size={46} color={sy.color} width={2} />
                  <b>{sy.label}</b>
                  <span>{sy.sub}</span>
                  {locked(sy.id) && <i>{sy.wip ? '開發中' : '🔒 無權限'}</i>}
                  {sy.wip && !locked(sy.id) && <i style={{ color: 'var(--accent)' }}>開發中</i>}
                </button>
              ))}
            </div>
            <Home key={rk} session={session} go={go} />
            <div className="ver-line">版本 {__BUILD__}</div>
          </div>
        )}
      </main>
      {newVer && <button className="newver" onClick={hardReload}>🔄 有新版本，點此更新</button>}
      {settings && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSettings(false) }}>
          <div className="sheet st-sheet st2">
            <div className="st2-hd">
              <div><h2 className="st-title">設定</h2>{session && <p className="st-who" style={{ margin: 0 }}>{session.name} · {session.dev ? '開發者' : ROLE_LABEL[session.role]}</p>}</div>
              <button className="mini" onClick={() => setSettings(false)}>關閉</button>
            </div>

            <div className="st2-sec">顯示</div>
            <div className="st2-card">
              <div className="st2-row"><span className="st2-lab">字體大小</span>
                <div className="st2-seg"><button className={!big ? 'on' : ''} onClick={() => setBig(false)}>標準</button><button className={big ? 'on' : ''} onClick={() => setBig(true)}>大字</button></div></div>
              <div className="st2-row"><span className="st2-lab">語言<small>公共地區</small></span>
                <div className="st2-seg"><button className={!paEn ? 'on' : ''} onClick={() => setPaLang(false)}>中文</button><button className={paEn ? 'on' : ''} onClick={() => setPaLang(true)}>English</button></div></div>
            </div>

            <div className="st2-sec">資料</div>
            <div className="st2-card">
              <button className="st2-row st2-act" onClick={async () => { await doRefresh(); setSettings(false) }}>
                <svg className={refreshing ? 'spin' : ''} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>
                <span className="st2-lab">{refreshing ? '更新中…' : '刷新資料'}<small>載入最新資料及版本</small></span><span className="st2-go">›</span>
              </button>
            </div>

            {session && session.dev && (
              <>
                <div className="st2-sec">開發者</div>
                <div className="st2-card">
                  <button className="st2-row st2-act" onClick={() => { setSettings(false); setPermOpen(true) }}>
                    <span className="st2-ico">🔐</span>
                    <span className="st2-lab">權限管理<small>查看及修改全部帳號權限</small></span><span className="st2-go">›</span>
                  </button>
                </div>
              </>
            )}

            <div className="st2-sec">帳號</div>
            <div className="st2-card">
              <button className="st2-row st2-act st2-out" onClick={() => { setSettings(false); setAskLogout(true) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                <span className="st2-lab">登出</span><span className="st2-go">›</span>
              </button>
            </div>
            <div className="ver-line" style={{ margin: '14px 0 0' }}>版本 {__BUILD__}</div>
          </div>
        </div>
      )}
      {permOpen && session && session.dev && <PermAdmin session={session} onClose={() => setPermOpen(false)} />}
      {askLogout && (
        <Confirm confirmLabel="登出" text={session ? `會登出「${session.name}」，之後要重新輸入密碼先可以再用。` : '會登出目前帳號。'}
          onCancel={() => setAskLogout(false)}
          onConfirm={async () => {
            setAskLogout(false)
            if (api.isOpen) { await api.signOut(); clearSession(); setTab('home'); setSessionState(null) } else { await api.signOut(); setUser(null) }
          }} />
      )}
      {(() => {
        // 底部導覽最多 5 格：項目多過 5 個時，首頁／品質／公共／缺陷留低，其餘（後勤、開發中模組）收入「更多」
        const all = [['home', '首頁', 'hotel'], ['quality', '品質', 'clipcheck'], ['boh', '後勤', 'box'], ['defect', '缺陷', 'wrench'], ['public', '公共', 'people'], ['uniform', '制服布草管理', 'shirt'], ['writeoff', '報銷與遺失管理', 'search'], ['roomsale', '房間可售物品', 'tag']]
          .filter(([id]) => !['uniform', 'writeoff', 'roomsale'].includes(id) || showSys({ id, dev: true }))
        const many = all.length > 5
        const main = many ? all.filter(([id]) => ['home', 'quality', 'public', 'defect'].includes(id)) : all
        const more = many ? all.filter(([id]) => !['home', 'quality', 'public', 'defect'].includes(id)) : []
        const devId = () => false
        const tapItem = (id, label) => { const lock = id !== 'home' && locked(id); if (lock) toast(devId(id) ? '開發中，暫時未開放' : '此帳號沒有權限進入「' + label + '」'); else { setMoreOpen(false); go(id) } }
        const area = ['boh', 'defect', 'public', 'uniform', 'writeoff', 'roomsale'].includes(tab) ? tab : tab === 'home' ? 'home' : 'quality'
        return (
          <>
            <nav className="gnav" aria-label="主導覽">
              {main.map(([id, label, ic]) => {
                const lock = id !== 'home' && locked(id)
                return (
                  <button key={id} className={`gnav-i ${area === id ? 'on' : ''} ${lock ? 'lock' : ''}`} onClick={() => tapItem(id, label)}>
                    <Icon name={ic} size={22} width={2} /><span>{label}</span>
                  </button>
                )
              })}
              {many && (
                <button className={`gnav-i ${more.some(([id]) => id === area) ? 'on' : ''}`} onClick={() => setMoreOpen(true)}>
                  <Icon name="more" size={22} width={2} /><span>更多</span>
                </button>
              )}
            </nav>
            {moreOpen && (
              <div className="modal" onClick={e => { if (e.target === e.currentTarget) setMoreOpen(false) }}>
                <div className="sheet more-sheet">
                  <div className="sheet-hd"><h2>更多模組</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setMoreOpen(false)}>關閉</button></span></div>
                  <div className="home-grid more-grid">
                    {more.map(([id, label, ic]) => {
                      const sy = SYSTEMS.find(x => x.id === id) || {}
                      const lock = locked(id)
                      return (
                        <button className={'home-item' + (lock ? ' pm-lockcard' : '')} key={id} onClick={() => tapItem(id, label)}>
                          <span className="hi-circle" style={{ background: (sy.color || '#4a6fa5') + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={sy.color || '#4a6fa5'} width={2.2} /></span>
                          <span className="hi-label">{sy.label || label}</span>
                          <span className="hi-sub">{lock ? (devId(id) ? '開發中' : '無權限') : (devId(id) ? '開發中' : sy.sub)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )
      })()}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
