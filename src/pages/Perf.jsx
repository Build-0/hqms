import { useMemo, useState } from 'react'
import { addDaysStr, todayStr } from '../lib/dates'
import { computePerf, LEVELS, PERF_DAYS, SCORE_DIMS, SCORE_MAX } from '../lib/perf'
import { staffName } from '../components/Staff'
import { ReportModal, ScoresReport } from '../components/Reports'

const Stars = ({ v }) => <span className="stars"><span className="f">{'★'.repeat(v)}</span><span className="o">{'★'.repeat(5 - v)}</span></span>
const RANGE = { 優良: '≥28', 一般: '21–27', 需注意: '18–20', 立刻培訓: '<18' }

// 人員表現：近 30 日由查房記錄自動推算（取代手動評分）
export default function Perf({ rows, tagById, atts, onStaff, edit }) {
  const [q, setQ] = useState('')
  const [fk, setFk] = useState('all')
  const [view, setView] = useState(null)
  const [report, setReport] = useState(false)
  const since = addDaysStr(-PERF_DAYS + 1)
  const map = useMemo(() => computePerf(rows, tagById, since), [rows, tagById, since])

  const people = atts.filter(a => a.active).map(a => ({ a, p: map.get(a.id) || null }))
  const rated = people.filter(x => x.p), unrated = people.filter(x => !x.p)
  const count = k => rated.filter(x => x.p.level.key === k).length
  const maxN = Math.max(1, ...LEVELS.map(l => count(l.key)), unrated.length)

  let shown = people
  const s = q.trim().toLowerCase()
  if (s) shown = people.filter(x => (staffName(x.a) + (x.a.floor || '') + (x.a.emp_id || '')).toLowerCase().includes(s))
  else if (fk === 'none') shown = unrated
  else if (fk !== 'all') shown = rated.filter(x => x.p.level.key === fk)
  shown = shown.slice().sort((x, y) => {
    if (!x.p && !y.p) return staffName(x.a).localeCompare(staffName(y.a))
    if (!x.p) return 1
    if (!y.p) return -1
    return x.p.total - y.p.total
  })

  const reportData = () => ({
    ratedN: rated.length, totalN: people.length, max: SCORE_MAX,
    levels: LEVELS.map(l => ({ key: l.key, color: l.color, n: count(l.key), range: RANGE[l.key] })),
    dimWeak: SCORE_DIMS.map(k => ({ k, n: rated.filter(x => x.p.dims[k] <= 2).length })),
    follow: rated.filter(x => ['立刻培訓', '需注意'].includes(x.p.level.key)).sort((x, y) => x.p.total - y.p.total)
      .map(x => ({ floor: x.a.floor, name: staffName(x.a), total: x.p.total, color: x.p.level.color, weak: x.p.weak, date: x.p.last })),
  })

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>近 {PERF_DAYS} 日表現<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（{rated.length}/{people.length} 人有記錄 · 滿分 {SCORE_MAX}）</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={() => setReport(true)}>📄 匯出</button>
            {edit && <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={onStaff}>👥 名單</button>}
          </div>
        </div>
        {LEVELS.map(l => (
          <div className={`bar-row click ${fk === l.key ? 'sel' : ''}`} key={l.key} onClick={() => setFk(fk === l.key ? 'all' : l.key)}>
            <span className="name" style={{ width: 96 }}><span style={{ color: l.color, fontWeight: 800 }}>{l.key}</span> <span style={{ fontSize: 10, color: 'var(--sub)' }}>{RANGE[l.key]}</span></span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${(count(l.key) / maxN) * 100}%`, background: l.color }} /></div>
            <span className="num">{count(l.key)}</span>
          </div>
        ))}
        <div className={`bar-row click ${fk === 'none' ? 'sel' : ''}`} onClick={() => setFk(fk === 'none' ? 'all' : 'none')}>
          <span className="name" style={{ width: 96, color: 'var(--sub)' }}>未有記錄</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(unrated.length / maxN) * 100}%`, background: '#c3ccd4' }} /></div>
          <span className="num">{unrated.length}</span>
        </div>
        <p className="src-note" style={{ marginTop: 8 }}>算法：七項各 5 分起，近 {PERF_DAYS} 日每個「有問題」標籤扣 1 分（扣在標籤所屬項目，最低 1 分）；每次「做得好」總分 +1。</p>
      </div>

      <input className="search-inp" placeholder="🔍 搜尋姓名、樓層、編號" value={q} onChange={e => setQ(e.target.value)} />
      {shown.length === 0 && <div className="note">沒有符合的人員</div>}
      {shown.map(({ a, p }) => (
        <div className="c-item" key={a.id} onClick={() => p && setView({ a, p })} style={p ? undefined : { opacity: .6 }}>
          <div className="c-head" style={{ cursor: p ? 'pointer' : 'default' }}>
            {p ? <span className="badge" style={{ background: p.level.color + '22', color: p.level.color, fontSize: 13, minWidth: 30, textAlign: 'center' }}>{p.total}</span> : <span className="badge b-gray">無</span>}
            {a.floor && a.floor !== '-' && <span style={{ fontSize: 11, color: 'var(--sub)', flexShrink: 0, width: 24 }}>{a.floor}</span>}
            <span className="sc-name">{staffName(a)}
              {p && p.weak.length > 0 && <span className="sc-weak">弱項：{p.weak.length > 3 ? `${p.weak.slice(0, 3).join('、')} 等 ${p.weak.length} 項` : p.weak.join('、')}</span>}
            </span>
            {p && <span style={{ fontSize: 11.5, color: 'var(--sub)', flexShrink: 0 }}>⚠{p.issueN} ⭐{p.goodN}</span>}
          </div>
        </div>
      ))}

      {view && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ margin: 0, flex: 1 }}>{staffName(view.a)}</h2>
              <span className="badge" style={{ background: view.p.level.color + '22', color: view.p.level.color, fontSize: 14 }}>{view.p.total} · {view.p.level.key}</span>
            </div>
            <p className="src-note">{view.a.floor || ''} · 近 {PERF_DAYS} 日 ⚠ 問題 {view.p.issueN} 次 · ⭐ 做得好 {view.p.goodN} 次</p>
            <div className="dim-grid">
              {SCORE_DIMS.map(k => (
                <div className="dim-cell" key={k}><span className="dv"><Stars v={view.p.dims[k]} /></span><span className="dk">{k}</span></div>
              ))}
              <div className="dim-cell total"><span className="dv" style={{ color: view.p.level.color }}>{view.p.total}</span><span className="dk">總分/{SCORE_MAX}</span></div>
            </div>
            {view.p.issues.length > 0 && <div className="fd-std"><div className="fd-std-h">❌ 問題記錄</div>
              {view.p.issues.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 15).map((it, i) => <div key={i} className="pf-line"><span>{it.date.slice(5)}</span><span>{it.name}{it.room ? ` · ${it.room}房` : ''}</span></div>)}
            </div>}
            {view.p.goods.length > 0 && <div className="fd-std"><div className="fd-std-h good">⭐ 做得好</div>
              {view.p.goods.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 10).map((it, i) => <div key={i} className="pf-line"><span>{it.date.slice(5)}</span><span>{it.name}</span></div>)}
            </div>}
            <button className="btn ghost" onClick={() => setView(null)}>關閉</button>
          </div>
        </div>
      )}
      {report && (
        <ReportModal title="人員表現報告" sub={`近 ${PERF_DAYS} 日 · ${todayStr()}`} onClose={() => setReport(false)}>
          <ScoresReport data={reportData()} />
        </ReportModal>
      )}
    </>
  )
}
