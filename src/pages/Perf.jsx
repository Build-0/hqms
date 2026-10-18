import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
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
    fk,
    people: people.map(x => ({ level: x.p ? x.p.level.key : '未有記錄', color: x.p ? x.p.level.color : '#97a3ad', floor: x.a.floor, name: staffName(x.a), total: x.p ? x.p.total : null, weak: x.p ? x.p.weak : [], date: x.p ? x.p.last : '' }))
      .sort((a, b) => (a.total ?? 999) - (b.total ?? 999)),
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
          <div className="tb-acts">
            {edit && <ToolBtn onClick={onStaff}>👥 名單</ToolBtn>}
            <ExportBtn onClick={() => setReport(true)} />
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

      <InspectorCompare rows={rows} since={since} atts={atts} />
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
              {view.p.issues.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 15).map((it, i) => <div key={i} className="pf-line"><span>{it.date.slice(5)}{it.time ? ` ${it.time}` : ''}</span><span>{it.name}{it.insp ? ` · ${it.insp}` : ''}{it.room ? ` · ${it.room}房` : ''}</span></div>)}
            </div>}
            {view.p.goods.length > 0 && <div className="fd-std"><div className="fd-std-h good">⭐ 做得好</div>
              {view.p.goods.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 10).map((it, i) => <div key={i} className="pf-line"><span>{it.date.slice(5)}{it.time ? ` ${it.time}` : ''}</span><span>{it.name}{it.insp ? ` · ${it.insp}` : ''}</span></div>)}
            </div>}
            <PersonSplit p={view.p} />
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

// 同一位同事：不同主管、不同時段嘅評價（上午／下午）
function PersonSplit({ p }) {
  const all = [...p.issues.map(x => ({ ...x, g: 0 })), ...p.goods.map(x => ({ ...x, g: 1 }))]
  const by = {}
  all.forEach(x => { const k = (x.insp || '').trim() || '未記錄'; by[k] = by[k] || { i: 0, g: new Set(), gb: 0 }; if (x.g) by[k].g.add(x.batch || x.date); else by[k].i++ })
  const insp = Object.entries(by)
  const am = { i: 0, g: new Set() }, pm = { i: 0, g: new Set() }
  let hasT = false
  all.forEach(x => { if (!x.time) return; hasT = true; const t = x.time < '12:00' ? am : pm; if (x.g) t.g.add(x.batch || x.date); else t.i++ })
  if (insp.length < 2 && !hasT) return null
  return (
    <div className="fd-std">
      {insp.length >= 1 && <><div className="fd-std-h" style={{ color: 'var(--ink)' }}>🧑‍💼 按主管（{insp.length} 位）</div>
        {insp.map(([k, v]) => <div key={k} className="pf-line"><span>{k}</span><span>⚠ {v.i}　⭐ {v.g.size}</span></div>)}</>}
      {hasT && <><div className="fd-std-h" style={{ color: 'var(--ink)', marginTop: 8 }}>🕐 按時段</div>
        <div className="pf-line"><span>上午（12:00 前）</span><span>⚠ {am.i}　⭐ {am.g.size}</span></div>
        <div className="pf-line"><span>下午（12:00 後）</span><span>⚠ {pm.i}　⭐ {pm.g.size}</span></div></>}
    </div>
  )
}

// 主管評核比較：每位主管嘅記錄數、問題與做得好比例；同一同事被不同主管給出相反評價嘅個案
function InspectorCompare({ rows, since, atts }) {
  const [open, setOpen] = useState(false)
  const isGood = f => String(f.batch || '').startsWith('good-')
  const by = {}, per = {}
  const seen = new Set()
  for (const f of rows) {
    if (f.date < since || !f.attendant_id) continue
    const insp = (f.inspector || '').trim() || '未記錄'
    const key = f.batch || f.id
    const o = (by[insp] = by[insp] || { n: 0, good: 0, issue: 0, atts: new Set() })
    if (!seen.has(insp + '|' + key)) { seen.add(insp + '|' + key); o.n++; isGood(f) ? o.good++ : o.issue++ }
    o.atts.add(f.attendant_id)
    const pp = (per[f.attendant_id] = per[f.attendant_id] || {})
    const q = (pp[insp] = pp[insp] || { good: new Set(), issue: 0 })
    isGood(f) ? q.good.add(key) : q.issue++
  }
  const list = Object.entries(by).sort((a, b) => b[1].n - a[1].n)
  if (list.length < 1) return null
  const nameOf = id => { const a = atts.find(x => x.id === id); return a ? (a.name || a.name_cn) : '' }
  const diverge = Object.entries(per).map(([id, m]) => {
    const e = Object.entries(m)
    const hasBad = e.filter(([, v]) => v.issue > 0).map(([k]) => k), hasGood = e.filter(([, v]) => v.good.size > 0).map(([k]) => k)
    return { id, bad: hasBad, good: hasGood, split: hasBad.length > 0 && hasGood.some(g => !hasBad.includes(g) || hasBad.length > 1) && e.length >= 2 }
  }).filter(x => x.split)
  return (
    <div className="card">
      <button className="linky" style={{ fontSize: 14, fontWeight: 700, padding: 0, width: '100%', textAlign: 'left' }} onClick={() => setOpen(!open)}>
        🧑‍💼 主管評核比較（{list.length} 位）{open ? '▲' : '▼'}
      </button>
      {open && (
        <>
          <p className="src-note">近 {PERF_DAYS} 日各主管的查房記錄：每次記錄計一次。好評率＝做得好 ÷ 總次數，可以看各主管評核標準是否一致。</p>
          <table className="rpt-t" style={{ fontSize: 13 }}>
            <thead><tr><th>主管</th><th>次數</th><th>⚠ 問題</th><th>⭐ 做得好</th><th>好評率</th></tr></thead>
            <tbody>
              {list.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{v.issue}</td><td>{v.good}</td><td><b>{Math.round(v.good / v.n * 100)}%</b></td></tr>)}
            </tbody>
          </table>
          {diverge.length > 0 && (
            <div className="fd-std" style={{ marginTop: 8 }}>
              <div className="fd-std-h" style={{ color: 'var(--ink)' }}>同一位同事、不同主管有不同評價（{diverge.length} 位）</div>
              {diverge.slice(0, 12).map(d => (
                <div key={d.id} className="pf-line"><span>{nameOf(d.id)}</span><span>⚠ {d.bad.join('、')}　⭐ {d.good.join('、')}</span></div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
