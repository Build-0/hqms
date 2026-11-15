import { useEffect, useRef, useState } from 'react'
import { TABS, SECTIONS, TV_NOTE, CHANNELS, FOOT } from '../data/hskpInfo'
import './hskp.css'

const BASE = import.meta.env.BASE_URL
const LKEY = 'hskp_lang'

// 房務資訊：早餐、餐廳、電視、洗衣、設施、商場、巴士、歐舒丹、價目表（由原 HSKP 網站搬入，中／英切換）
export default function HskpInfo() {
  const [tab, setTab] = useState(TABS[0].id)
  const [en, setEn] = useState(() => { try { return localStorage.getItem(LKEY) === 'en' } catch { return false } })
  const [q, setQ] = useState('')
  const box = useRef(null)

  const setLang = v => { setEn(v); try { localStorage.setItem(LKEY, v ? 'en' : 'zh') } catch { /* 無法儲存時照常使用 */ } }

  // 靜態 HTML 內嘅中英文：切換語言時改文字（靜態內容 React 唔會重繪，所以要手動改）
  useEffect(() => {
    if (!box.current) return
    box.current.querySelectorAll('[data-zh]').forEach(e => { e.textContent = en ? e.dataset.en : e.dataset.zh })
  }, [en, tab, q])

  const onClick = e => {
    const h = e.target.closest('.hk-accordion-header')
    if (h && h.parentElement) h.parentElement.classList.toggle('hk-open')
  }

  const k = q.trim().toLowerCase()
  const list = CHANNELS.filter(c => !k || c.zh.toLowerCase().includes(k) || c.en.toLowerCase().includes(k) || String(c.n).includes(k))
  const html = (SECTIONS[tab] || '').split('{BASE}').join(BASE)

  return (
    <div className="hskp" ref={box} onClick={onClick} style={{ background: 'transparent', fontSize: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div className="chips" style={{ flex: 1, margin: 0, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TABS.map(t => (
            <button key={t.id} className={`chip ${tab === t.id ? 'on' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(t.id)}>
              {t.icon} {en ? t.en : t.zh}
            </button>
          ))}
        </div>
        <div className="chips" style={{ margin: 0, flexShrink: 0 }}>
          <button className={`chip ${!en ? 'on' : ''}`} onClick={() => setLang(false)}>中</button>
          <button className={`chip ${en ? 'on' : ''}`} onClick={() => setLang(true)}>EN</button>
        </div>
      </div>

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
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}

      <div className="hk-footer" style={{ border: 'none', marginTop: 8, padding: '12px 6px' }}>
        {FOOT.map((f, i) => <p key={i} style={i ? { marginTop: 6, fontSize: 13, color: '#888' } : undefined}>{en ? f.en : f.zh}</p>)}
      </div>
    </div>
  )
}
