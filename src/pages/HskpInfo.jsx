import { useEffect, useRef, useState } from 'react'
import { TABS, SECTIONS, TV_NOTE, CHANNELS, FOOT } from '../data/hskpInfo'
import { itemLevel } from '../lib/accounts'
import * as api from '../lib/api'
import { toast } from '../lib/toast'
import './hskp.css'

const BASE = import.meta.env.BASE_URL
const CELL = ['TD', 'TH', 'LI', 'P', 'H2', 'H3', 'H4']

// 房務資訊：早餐、餐廳、電視、洗衣、設施、商場、巴士、歐舒丹、價目表（由原 HSKP 網站搬入，中／英切換）
// 有編輯權限（權限管理 → 房務資訊 = 編輯）嘅人可以直接改字、加／刪行；改完存入資料庫，所有人見到最新版
export default function HskpInfo({ session }) {
  const [tab, setTab] = useState(TABS[0].id)
  // 語言跟右上角「設定」：設定寫入 localStorage 再發出 pa-lang 事件
  const [en, setEn] = useState(() => { try { return localStorage.getItem('pa_lang') === 'en' } catch { return false } })
  useEffect(() => {
    const fn = () => { try { setEn(localStorage.getItem('pa_lang') === 'en') } catch { /* 讀唔到就保持現狀 */ } }
    window.addEventListener('pa-lang', fn)
    return () => window.removeEventListener('pa-lang', fn)
  }, [])
  const [q, setQ] = useState('')
  const [ov, setOv] = useState({})        // 資料庫入面改過嘅版本 { 分頁id: html }
  const [edit, setEdit] = useState(false)
  const [rk, setRk] = useState(0)         // 放棄修改時重畫內容
  const [busy, setBusy] = useState(false)
  const box = useRef(null)
  const body = useRef(null)
  const focus = useRef(null)              // 最後點過嘅編輯格
  const canEdit = itemLevel(session, 'hskp') === 'edit' && tab !== 'tv'

  useEffect(() => { api.hskpLoad().then(setOv) }, [])
  useEffect(() => { setEdit(false) }, [tab])

  const html = (ov[tab] ?? SECTIONS[tab] ?? '').split('{BASE}').join(BASE)

  // 靜態 HTML 內嘅中英文：切換語言時改文字（靜態內容 React 唔會重繪，所以要手動改）
  useEffect(() => {
    if (!body.current) return
    body.current.querySelectorAll('[data-zh]').forEach(e => { e.textContent = en ? e.dataset.en : e.dataset.zh })
  }, [en, tab, q, html, rk])

  // 開／關編輯：想改嘅格加上 contenteditable
  useEffect(() => {
    const b = body.current
    if (!b) return
    b.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'))
    if (!edit) return
    b.querySelectorAll('*').forEach(e => {
      if (e.hasAttribute('data-zh') || (CELL.includes(e.tagName) && !e.querySelector('[data-zh]'))) e.setAttribute('contenteditable', 'true')
    })
  }, [edit, tab, html, rk])

  const onClick = e => {
    if (edit) return
    const h = e.target.closest('.hk-accordion-header')
    if (h && h.parentElement) h.parentElement.classList.toggle('hk-open')
  }
  // 改字：同步寫入 data-zh／data-en（咁切換語言先唔會打回原形）
  const onInput = e => {
    const t = e.target.closest && e.target.closest('[data-zh]')
    if (t) t.dataset[en ? 'en' : 'zh'] = t.textContent
  }
  const onFocus = e => { focus.current = e.target.closest ? e.target.closest('[contenteditable]') : null }
  const onPaste = e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }

  const rowOf = () => {
    const f = focus.current
    return f && body.current && body.current.contains(f) ? f.closest('tr,li') : null
  }
  const addRow = () => {
    const r = rowOf()
    if (!r) { toast('先點一下想喺邊行之後加'); return }
    const c = r.cloneNode(true)
    c.querySelectorAll('[data-zh]').forEach(e => { e.dataset.zh = ''; e.dataset.en = ''; e.textContent = '' })
    c.querySelectorAll('td,th,li').forEach(e => { if (!e.querySelector('[data-zh]') && !e.hasAttribute('data-zh')) e.textContent = '' })
    if (r.parentElement.tagName === 'THEAD') {
      const tb = r.parentElement.nextElementSibling
      if (tb) tb.prepend(c); else r.after(c)
    } else r.after(c)
    c.querySelectorAll('td,th,li,[data-zh]').forEach(e => { if (e.hasAttribute('data-zh') || !e.querySelector('[data-zh]')) e.setAttribute('contenteditable', 'true') })
    const f = c.querySelector('[contenteditable]'); if (f) f.focus()
  }
  const delRow = () => {
    const r = rowOf()
    if (!r) { toast('先點一下想刪嗰行'); return }
    if (r.parentElement.tagName === 'THEAD') { toast('表頭唔可以刪'); return }
    if (!window.confirm('刪除呢一行？')) return
    r.remove(); focus.current = null
  }

  async function save() {
    const b = body.current
    if (!b) return
    setBusy(true)
    try {
      const c = b.cloneNode(true)
      c.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'))
      c.querySelectorAll('.hk-open').forEach(e => e.classList.remove('hk-open'))
      const h = c.innerHTML.split(`src="${BASE}`).join('src="{BASE}')
      await api.hskpSave(tab, h, session && (session.name || session.key))
      setOv(o => ({ ...o, [tab]: h }))
      setEdit(false); toast('已儲存，所有人即時見到')
    } catch (ex) { toast('儲存失敗：' + ex.message) }
    setBusy(false)
  }
  function cancel() { setEdit(false); setRk(x => x + 1) }
  async function reset() {
    if (!window.confirm('還原呢一頁做最初版本？你改過嘅內容會被取代。')) return
    setBusy(true)
    try {
      await api.hskpReset(tab)
      setOv(o => { const n = { ...o }; delete n[tab]; return n })
      setEdit(false); setRk(x => x + 1); toast('已還原')
    } catch (ex) { toast('還原失敗：' + ex.message) }
    setBusy(false)
  }

  const k = q.trim().toLowerCase()
  const list = CHANNELS.filter(c => !k || c.zh.toLowerCase().includes(k) || c.en.toLowerCase().includes(k) || String(c.n).includes(k))

  return (
    <div className="hskp" ref={box} onClick={onClick} >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div className="chips" style={{ flex: 1, margin: 0, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TABS.map(t => (
            <button key={t.id} className={`chip ${tab === t.id ? 'on' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(t.id)}>
              {t.icon} {en ? t.en : t.zh}
            </button>
          ))}
        </div>
        {canEdit && !edit && <button className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setEdit(true)}>✏️ 編輯</button>}
      </div>

      {edit && (
        <div className="hk-edbar">
          <div className="hk-edhint">✏️ 編輯中（{en ? '英文版' : '中文版'}）：直接點字就改。要改另一種語言，先到右上角設定轉語言再編輯。</div>
          <div className="hk-edbtns">
            <button className="btn sm" onClick={addRow}>＋ 喺所選行後加一行</button>
            <button className="btn sm" onClick={delRow}>－ 刪所選行</button>
            {ov[tab] != null && <button className="btn sm" disabled={busy} onClick={reset}>↩ 還原最初版</button>}
            <span style={{ flex: 1 }} />
            <button className="btn sm" disabled={busy} onClick={cancel}>取消</button>
            <button className="btn sm primary" disabled={busy} onClick={save}>{busy ? '儲存中…' : '💾 儲存'}</button>
          </div>
        </div>
      )}

      {tab === 'tv' ? (
        <div className="hk-card">
          <h2 className="hk-card-title">📺 {en ? 'TV Channels' : '電視頻道表'}</h2>
          <div className="hk-tv-note"><strong>⚠️</strong> {en ? TV_NOTE.noteEn : TV_NOTE.note}</div>
          <div className="hk-search-box">
            <span className="hk-search-icon">🔍</span>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder={en ? 'Search...' : '搜尋頻道…'} />
          </div>
          <div className="hk-channel-grid">
            {list.map(c => (
              <div className="hk-channel-item" key={c.n}>
                <div className="hk-channel-number">{c.n}</div>
                <div className="hk-channel-name">{en ? c.en : c.zh}</div>
              </div>
            ))}
            {!list.length && <div className="note">{en ? 'No match' : '搵唔到相符頻道'}</div>}
          </div>
        </div>
      ) : (
        <div key={rk + ':' + tab} ref={body} className={edit ? 'hk-editing' : ''} onInput={onInput} onFocus={onFocus} onPaste={onPaste} dangerouslySetInnerHTML={{ __html: html }} />
      )}

      <div className="hk-footer" style={{ border: 'none', marginTop: 8, padding: '12px 6px' }}>
        {FOOT.map((f, i) => <p key={i} style={i ? { marginTop: 6, fontSize: 13, color: '#888' } : undefined}>{en ? f.en : f.zh}</p>)}
      </div>
    </div>
  )
}
