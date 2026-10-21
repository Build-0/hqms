import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { todayStr } from '../lib/dates'
import { canExport, EXPORT_MSG } from '../lib/accounts'
import { savePdf } from '../lib/pdf'

// 報告外殼：全螢幕預覽 + 「儲存為 PDF」（瀏覽器列印 → 另存 PDF；手機用分享 → 列印/存成 PDF）
export function ReportModal({ title, sub, onClose, children }) {
  useEffect(() => {
    const old = document.title
    const clean = x => String(x || '').replace(/[\\/:*?"<>|]/g, '-').trim()
    document.title = [clean(title), clean(sub)].filter(Boolean).join(' ') || old
    document.documentElement.classList.add('rpt-open')   // 報告開啟時隱藏背後頁面（避免玻璃模糊層蓋住報告頂部掣）
    return () => { document.title = old; document.documentElement.classList.remove('rpt-open') }
  }, [title, sub])
  // 只有管理員可以匯出；其他帳號只顯示提示
  if (!canExport()) {
    return createPortal(
      <div className="modal" style={{ zIndex: 90 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="sheet center">
          <h2 style={{ marginBottom: 6 }}>🔒 沒有匯出權限</h2>
          <p style={{ fontSize: 14, color: 'var(--sub)', lineHeight: 1.7, marginBottom: 14 }}>{EXPORT_MSG}</p>
          <button className="btn" onClick={onClose}>知道了</button>
        </div>
      </div>,
      document.body
    )
  }
  const [busy, setBusy] = useState(false)
  async function toPdf() {
    if (busy) return
    setBusy(true)
    try {
      const el = document.querySelector('.rpt-print')
      const how = await savePdf(el, document.title || 'report')
      if (how === 'download') alert('PDF 已下載。若沒有出現，請到「檔案」App → 下載項目查看。')
    } catch (e) { alert('產生 PDF 失敗：' + (e && e.message ? e.message : e)); window.print() }
    setBusy(false)
  }
  const now = new Date()
  const stamp = `${todayStr()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return createPortal(
    <div className="rpt-overlay">
      <div className="rpt-bar">
        <button className="rpt-btn ghost" onClick={onClose}>‹ 返回</button>
        <span className="rpt-bar-t">報告預覽</span>
        <button className="rpt-btn" disabled={busy} onClick={toPdf}>{busy ? '產生中…' : '儲存為 PDF'}</button>
      </div>
      <div className="rpt-scroll">
        <div className="rpt-print">
          <div className="rpt-hd"><b>{title}</b><span>{sub}</span></div>
          {children}
          <div className="rpt-ft"><span>酒店客房管理系統</span><span>匯出時間 {stamp}</span></div>
        </div>
      </div>
      <div className="rpt-foot rpt-noprint">
        <button className="btn ghost" onClick={onClose}>‹ 返回</button>
        <button className="btn ghost" style={{ flex: '0 0 26%' }} onClick={() => window.print()}>列印</button>
        <button className="btn" disabled={busy} onClick={toPdf}>{busy ? '產生中…' : '儲存為 PDF'}</button>
      </div>
    </div>,
    document.body
  )
}

const Empty = ({ children = '沒有資料' }) => <p className="rpt-mut">{children}</p>
const Sub = ({ children }) => <div className="rpt-sub">{children}</div>
const Bars = ({ rows, color = '#5a6b7d' }) => {
  const max = Math.max(1, ...rows.map(r => r.n))
  return rows.map(r => (
    <div className="rpt-bar-row" key={r.k}>
      <em>{r.k}</em>
      <div className="rpt-track"><i style={{ width: `${(r.n / max) * 100}%`, background: r.color || color }} /></div>
      <u>{r.n}</u>
    </div>
  ))
}

// ── 房務員清潔評分 ──
export function ScoresReport({ data }) {
  const { ratedN, totalN, max, levels, dimWeak, follow, people = [] } = data
  // 先揀範圍（全部／某一分級／未有記錄），預設跟目前畫面的篩選
  const [lv, setLv] = useState(data.fk && data.fk !== 'all' ? (data.fk === 'none' ? '未有記錄' : data.fk) : '')
  const picked = lv ? people.filter(p => p.level === lv) : []
  if (lv) {
    return (
      <>
        <div className="chips wrap rpt-noprint">
          <button className={`chip ${!lv ? 'on' : ''}`} onClick={() => setLv('')}>全部</button>
          {[...levels.map(l => l.key), '未有記錄'].map(k => <button key={k} className={`chip ${lv === k ? 'on' : ''}`} onClick={() => setLv(k)}>{k}</button>)}
        </div>
        <p className="rpt-mut">近 30 日 · 範圍：{lv} · 共 {picked.length} 人 · 滿分 {max}</p>
        {picked.length === 0 ? <Empty>沒有符合的人員</Empty> : (
          <table className="rpt-t">
            <thead><tr><th>樓層</th><th>姓名</th><th>總分</th><th>弱項</th><th>最近評分</th></tr></thead>
            <tbody>
              {picked.map((p, i) => (
                <tr key={i}>
                  <td>{p.floor || '—'}</td><td>{p.name}</td>
                  <td>{p.total == null ? '—' : <span className="rpt-tag" style={{ background: p.color }}>{p.total}</span>}</td>
                  <td className="rpt-red">{p.weak.length >= 7 ? '全部 7 項' : p.weak.join('、') || '—'}</td>
                  <td className="rpt-mut">{p.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    )
  }
  return (
    <>
      <div className="chips wrap rpt-noprint">
        <button className="chip on" onClick={() => setLv('')}>全部</button>
        {[...levels.map(l => l.key), '未有記錄'].map(k => <button key={k} className="chip" onClick={() => setLv(k)}>{k}</button>)}
      </div>
      <p className="rpt-mut">近 30 日有記錄 {ratedN} / {totalN} 人 · 滿分 {max}</p>
      <Sub>分數分布</Sub>
      <div className="rpt-kpis">
        {levels.map(l => (
          <div className="rpt-k" key={l.key}><b style={{ color: l.color }}>{l.n}</b><small>{l.key} {l.range}</small></div>
        ))}
      </div>
      <Sub>單項弱項人數（≤2 分）</Sub>
      {dimWeak.some(d => d.n > 0) ? <Bars rows={dimWeak.map(d => ({ k: d.k, n: d.n }))} /> : <Empty>沒有弱項</Empty>}
      <Sub>需跟進名單（立刻培訓 + 需注意，分數低至高）</Sub>
      {follow.length === 0 ? <Empty>沒有需跟進人員</Empty> : (
        <table className="rpt-t">
          <thead><tr><th>樓層</th><th>姓名</th><th>總分</th><th>弱項</th><th>最近評分</th></tr></thead>
          <tbody>
            {follow.map((p, i) => (
              <tr key={i}>
                <td>{p.floor || '—'}</td><td>{p.name}</td>
                <td><span className="rpt-tag" style={{ background: p.color }}>{p.total}</span></td>
                <td className="rpt-red">{p.weak.length >= 7 ? '全部 7 項' : p.weak.join('、') || '—'}</td>
                <td className="rpt-mut">{p.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

// ── 客訴月報 ──
export function ComplaintsReport({ data }) {
  const { inv, ab, eng, total, rank, floorRank, rows } = data
  const [withPhotos, setWithPhotos] = useState(true)
  const hasPhoto = rows.some(c => (c.photos || []).length)
  return (
    <>
      <p className="rpt-mut">客房投訴 {inv} 單 · 濫訴 {ab} 單 · 工程與其他 {eng} 單 · 合計 {total} 單</p>
      <div className="rpt-two">
        <div><Sub>分類排行（客房投訴）</Sub>{rank.length ? <Bars rows={rank.map(r => ({ k: r.cat, n: r.n }))} color="#1f7a6d" /> : <Empty />}</div>
        <div><Sub>樓層分佈（客房投訴）</Sub>{floorRank.length ? <Bars rows={floorRank.map(([f, n]) => ({ k: f === '無房號' ? f : `${f} 樓`, n }))} /> : <Empty />}</div>
      </div>
      <Sub>客訴明細</Sub>
      {hasPhoto && <label className="rpt-noprint rpt-check"><input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} /> 附上相片</label>}
      {rows.length === 0 ? <Empty>本月沒有記錄</Empty> : (
        <table className="rpt-t">
          <thead><tr><th>日期</th><th>房號</th><th>分類</th><th>客人反映</th><th>改善措施</th></tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i}>
                <td className="rpt-nw">{c.date.slice(5)}</td><td className="rpt-nw">{c.room}</td>
                <td>{c.category}{c.tag ? <span className="rpt-mut"> · {c.tag}</span> : ''}</td>
                <td>{c.guest_comment}{withPhotos && (c.photos || []).length > 0 && <div className="rpt-fd-ph">{c.photos.slice(0, 3).map((p, k) => <img key={k} src={p} alt="" />)}</div>}</td><td>{c.improvement || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

// ── 今日重點 ──
export function DailyReport({ slots }) {
  return slots.map((s, i) => {
    const c = s.complaint, t = s.topic
    return (
      <div className="rpt-keep" key={i}>
        <Sub>{slots.length > 1 ? `重點${['一', '二'][i]} · ` : ''}{c ? `昨日客訴 · ${c.room} 房` : `主題輪替 · ${t.category}`}</Sub>
        <div className="rpt-title">{c ? `客人反映：${c.guest_comment}` : t.title}</div>
        {c ? (
          <div className="rpt-two">
            <div className="rpt-box"><h4>✗ 實際原因</h4><p>{c.actual_cause || '—'}</p></div>
            <div className="rpt-box"><h4>✓ 正確標準</h4><p>{c.correct_standard || '—'}</p></div>
          </div>
        ) : (
          <>
            {t.why && <p className="rpt-mut">{t.why}</p>}
            <div className="rpt-two">
              <div className="rpt-box"><h4>✓ 正確做法</h4>{(t.correct_steps || []).map((x, k) => <p key={k}>{k + 1}. {x}</p>)}</div>
              <div className="rpt-box"><h4>✗ 常見錯誤</h4>{(t.mistakes || []).map((x, k) => <p key={k}>• {x}</p>)}</div>
            </div>
          </>
        )}
        {c && c.improvement && <p><b>主管重點檢查：</b>{c.improvement}</p>}
      </div>
    )
  })
}

// ── 培訓主題庫 ──
export function TopicsReport({ groups, total }) {
  const [withPhotos, setWithPhotos] = useState(true)
  const hasPhoto = groups.some(g => g.items.some(t => (t.photos || []).length))
  return (
    <>
      <p className="rpt-mut">共 {total} 個主題 · {groups.length} 個分類</p>
      {hasPhoto && <label className="rpt-noprint rpt-check"><input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} /> 附上相片</label>}
      {groups.map(g => (
        <div key={g.name}>
          <Sub>{g.name} · {g.items.length} 個主題</Sub>
          {g.items.length === 0 ? <Empty>沒有主題</Empty> : (
            <table className="rpt-t">
              <thead><tr><th style={{ width: '26%' }}>主題</th><th>正確做法</th><th style={{ width: '30%' }}>常見錯誤</th></tr></thead>
              <tbody>
                {g.items.map(t => (
                  <tr key={t.id}>
                    <td><b>{t.title}</b>{withPhotos && (t.photos || []).length > 0 && <div className="rpt-fd-ph">{t.photos.slice(0, 2).map((p, k) => <img key={k} src={p} alt="" />)}</div>}</td>
                    <td>{(t.correct_steps || []).length ? t.correct_steps.map((x, i) => <div key={i}>{i + 1}. {x}</div>) : '—'}</td>
                    <td>{(t.mistakes || []).length ? t.mistakes.map((x, i) => <div key={i}>• {x}</div>) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </>
  )
}

// ── 清潔要點 ──
export function CleaningReport({ data }) {
  const { daily, spot, cycle, deep, only } = data
  const show = k => !only || only === k
  const ph = r => [...(r.photos || []).slice(0, 2).map(p => ['✓', p]), ...(r.photos_wrong || []).slice(0, 2).map(p => ['✗', p])]
  const tbl = (rows, withWrong) => (
    <table className="rpt-t">
      <thead><tr><th style={{ width: '22%' }}>類別</th><th>項目</th>{withWrong && <th style={{ width: '26%' }}>常見錯誤</th>}<th style={{ width: '24%' }}>相片</th></tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={i}><td>{[r.grp, r.area].filter(Boolean).join(' · ') || '—'}</td><td>{r.text}</td>{withWrong && <td>{r.wrong || '—'}</td>}<td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{ph(r).map(([m, p], k) => <span key={k} style={{ position: 'relative' }}><img className="rpt-th" src={p} alt="" /><small style={{ position: 'absolute', left: 1, top: 0, fontSize: 10, fontWeight: 800, color: m === '✓' ? '#1b8a5a' : '#c62828' }}>{m}</small></span>)}</div></td></tr>)}
      </tbody>
    </table>
  )
  return (
    <>
      {show('daily') && <><Sub>每日清潔 · {daily.length} 項</Sub>{daily.length ? tbl(daily, true) : <Empty />}</>}
      {show('spot') && <><Sub>常見錯誤／衛生點 · {spot.length} 項</Sub>{spot.length ? tbl(spot, true) : <Empty />}</>}
      {show('cycle') && <><Sub>循環清潔（每月排程）· {cycle.length} 項</Sub>
      {cycle.length ? (
        <table className="rpt-t">
          <thead><tr><th style={{ width: '16%' }}>日期</th><th>項目</th></tr></thead>
          <tbody>{cycle.map((r, i) => <tr key={i}><td className="rpt-nw">{r.day ? `每月 ${r.day} 號` : '不定期'}</td><td>{r.text}</td></tr>)}</tbody>
        </table>
      ) : <Empty />}</>}
      {show('deep') && <><Sub>深度清潔 · {deep.length} 項</Sub>{deep.length ? tbl(deep, false) : <Empty />}</>}
    </>
  )
}

// ── 查房記錄 ──
export function FindingsReport({ data, withPhotos, onTogglePhotos }) {
  const { issueN, goodN, peopleN, tagRank, byPerson, repeats, rows } = data
  return (
    <>
      <div className="rpt-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="rpt-k"><b style={{ color: '#c62828' }}>{issueN}</b><small>有問題（次）</small></div>
        <div className="rpt-k"><b style={{ color: '#1b8a5a' }}>{goodN}</b><small>做得好（次）</small></div>
        <div className="rpt-k"><b>{peopleN}</b><small>涉及同事</small></div>
      </div>
      <div className="rpt-two">
        <div><Sub>問題類型排行</Sub>{tagRank.length ? <Bars rows={tagRank} color="#c62828" /> : <Empty>沒有問題記錄</Empty>}</div>
        <div><Sub>重複出現（30 日內同一問題 ≥2 次）</Sub>
          {repeats.length ? <table className="rpt-t"><tbody>{repeats.slice(0, 10).map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.tag}</td><td className="rpt-red">×{r.n}</td></tr>)}</tbody></table> : <Empty>沒有</Empty>}
        </div>
      </div>
      <Sub>按同事統計</Sub>
      {byPerson.length === 0 ? <Empty /> : (
        <table className="rpt-t">
          <thead><tr><th>樓層</th><th>同事</th><th>有問題</th><th>做得好</th></tr></thead>
          <tbody>{byPerson.map((p, i) => <tr key={i}><td>{p.floor || '—'}</td><td>{p.name}</td><td className={p.issue ? 'rpt-red' : 'rpt-mut'}>{p.issue}</td><td style={{ color: p.good ? '#1b8a5a' : '#6b7785' }}>{p.good}</td></tr>)}</tbody>
        </table>
      )}
      <Sub>記錄明細</Sub>
      <label className="rpt-noprint rpt-check"><input type="checkbox" checked={withPhotos} onChange={e => onTogglePhotos(e.target.checked)} /> 附上相片</label>
      {rows.length === 0 ? <Empty>這段時間沒有記錄</Empty> : rows.map((r, i) => (
        <div className="rpt-fd" key={i}>
          {withPhotos && r.photos.length > 0 && (
            <div className="rpt-fd-ph">{r.photos.slice(0, 4).map((p, k) => <img key={k} src={p} alt="" />)}</div>
          )}
          <div className="rpt-fd-tx">
            <div><b>{r.name}</b>{r.room ? <span className="rpt-mut"> · {r.room} 房</span> : ''} <span className="rpt-mut">· {r.date.slice(5)}</span></div>
            <div style={{ color: r.kind === 'good' ? '#1b8a5a' : '#c62828', fontWeight: 700 }}>{r.kind === 'good' ? '⭐ 做得好：' : '⚠ 問題：'}{r.tags}</div>
            {r.note && <div className="rpt-mut">{r.note}</div>}
          </div>
        </div>
      ))}
    </>
  )
}

const obj2rows = (o, extra) => Object.entries(o || {}).map(([k, n]) => ({ k, n, ...(extra || {}) })).sort((a, b) => b.n - a.n)

// ── 後勤管理 ──
export function BohReport({ data }) {
  const { products, low, expiring, vacuums, equipment, tools } = data
  const abn = (o, ok) => Object.entries(o || {}).filter(([k]) => k !== ok).reduce((n, [, v]) => n + v, 0)
  const eqStatuses = [...new Set(Object.values(equipment.byType).flatMap(o => Object.keys(o)))]
  return (
    <>
      <div className="rpt-kpis">
        <div className="rpt-k"><b>{products.active}</b><small>清潔劑（上架）</small></div>
        <div className="rpt-k"><b style={{ color: low.length ? '#c62828' : undefined }}>{low.length}</b><small>需補貨</small></div>
        <div className="rpt-k"><b style={{ color: expiring.length ? '#e69500' : undefined }}>{expiring.length}</b><small>30 日內到期</small></div>
        <div className="rpt-k"><b>{abn(vacuums.byStatus, '正常') + abn(equipment.byStatus, '正常')}</b><small>非正常機器</small></div>
      </div>
      <Sub>需補貨清潔劑</Sub>
      {low.length === 0 ? <Empty>沒有需補貨項目</Empty> : (
        <table className="rpt-t"><thead><tr><th>清潔劑</th><th>現有</th><th>最低</th></tr></thead>
          <tbody>{low.map((p, i) => <tr key={i}><td>{p.name}</td><td className="rpt-red">{p.stock}</td><td>{p.min}</td></tr>)}</tbody></table>
      )}
      <Sub>臨期／已過期批次（30 日內）</Sub>
      {expiring.length === 0 ? <Empty>沒有臨期批次</Empty> : (
        <table className="rpt-t"><thead><tr><th>清潔劑</th><th>到期日</th><th>剩餘</th><th>狀態</th></tr></thead>
          <tbody>{expiring.map((b, i) => <tr key={i}><td>{b.name}</td><td className="rpt-nw">{b.expiry}</td><td>{b.qty}</td><td className={b.days < 0 ? 'rpt-red' : ''}>{b.days < 0 ? '已過期' : '剩 ' + b.days + ' 天'}</td></tr>)}</tbody></table>
      )}
      <div className="rpt-two">
        <div><Sub>吸塵機 · 共 {vacuums.total} 台</Sub>
          <Bars rows={obj2rows(vacuums.byStatus)} color="#1f7a6d" />
          <Sub>吸塵機位置分佈</Sub>
          <Bars rows={obj2rows(vacuums.byFloor).slice(0, 12)} />
        </div>
        <div><Sub>設備 · 共 {equipment.total} 台</Sub>
          <table className="rpt-t"><thead><tr><th>類型</th>{eqStatuses.map(s => <th key={s}>{s}</th>)}</tr></thead>
            <tbody>{Object.entries(equipment.byType).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)).map(([t, o]) => <tr key={t}><td>{t}</td>{eqStatuses.map(s => <td key={s} className={s !== '正常' && o[s] ? 'rpt-red' : ''}>{o[s] || '—'}</td>)}</tr>)}</tbody></table>
        </div>
      </div>
      <Sub>清潔工具 · 共 {tools.total} 項</Sub>
      <table className="rpt-t"><thead><tr><th>分類</th><th>項數</th><th>庫存合計</th></tr></thead>
        <tbody>{Object.entries(tools.byCat).sort((a, b) => b[1].items - a[1].items).map(([c, o]) => <tr key={c}><td>{c}</td><td>{o.items}</td><td>{o.stock}</td></tr>)}</tbody></table>
    </>
  )
}

// ── 缺陷管理（舊版，已由下面按樓層版本取代）──
export function DefectReport({ data }) {
  const { rows, filterText, severity, status } = data
  const [withPhotos, setWithPhotos] = useState(true)
  const lab = (arr, v) => (arr.find(x => x.value === v) || {}).label || v || '—'
  const sevColor = { high: '#c62828', medium: '#e69500', low: '#2f6fba' }
  const cnt = st => rows.filter(d => d.status === st).length
  const floors = [...new Set(rows.map(d => d.floor || ''))].sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
  const clean = n => String(n || '').replace(/\s*【查房#[^】]*】/g, '').trim()
  return (
    <>
      <p className="rpt-mut">篩選：{filterText}　·　共 {rows.length} 筆</p>
      <div className="rpt-kpis">
        <div className="rpt-k"><b>{rows.length}</b><small>符合筆數</small></div>
        <div className="rpt-k"><b style={{ color: '#c62828' }}>{cnt('pending')}</b><small>待處理</small></div>
        <div className="rpt-k"><b style={{ color: '#e69500' }}>{cnt('processing')}</b><small>處理中</small></div>
        <div className="rpt-k"><b style={{ color: '#1b8a5a' }}>{cnt('done')}</b><small>已修復</small></div>
      </div>
      <label className="rpt-noprint rpt-check"><input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} /> 附上相片</label>
      {rows.length === 0 && <Empty>沒有符合篩選的記錄</Empty>}
      {floors.map(f => {
        const list = rows.filter(d => (d.floor || '') === f).sort((a, b) => String(a.room).localeCompare(String(b.room), undefined, { numeric: true }) || String(a.register_date || a.created_at).localeCompare(String(b.register_date || b.created_at)))
        return (
          <div key={f}>
            <Sub>{f ? f + ' 樓' : '（未填樓層）'} · {list.length} 筆</Sub>
            {list.map((d, i) => (
              <div className="rpt-fd" key={i}>
                {withPhotos && Array.isArray(d.photos) && d.photos.length > 0 && <div className="rpt-fd-ph">{d.photos.slice(0, 2).map((p, k) => <img key={k} src={p} alt="" />)}</div>}
                <div className="rpt-fd-tx">
                  <div><b style={{ fontSize: '1.15em' }}>{d.room}</b> <span className="rpt-tag" style={{ background: sevColor[d.severity] || '#6b7785' }}>{lab(severity, d.severity)}</span> <span className="rpt-mut">{lab(status, d.status)} · {d.register_date || (d.created_at || '').slice(0, 10)}</span></div>
                  <div style={{ fontWeight: 700 }}>{d.type}</div>
                  {clean(d.note) && <div className="rpt-mut">{clean(d.note)}</div>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

// ── 早會講稿：管理員揀最多 3 項，列印成一張紙，早會沒有特別事項時照著講 ──
export function SpeechSheet({ items }) {
  const list = (a, tag) => (a && a.length ? <ol className="rpt-sl">{a.map((x, i) => <li key={i}>{x}</li>)}</ol> : null)
  const bul = a => (a && a.length ? <ul className="rpt-sl">{a.map((x, i) => <li key={i}>{x}</li>)}</ul> : null)
  return (
    <div className="rpt-big">
      {items.length === 0 && <Empty>尚未選擇內容</Empty>}
      {items.map((it, idx) => {
        const t = it.topic, c = it.complaint
        const okP = t ? (t.photos || []).slice(0, 2) : [], noP = t ? (t.photos_wrong || []).slice(0, 2) : []
        const photos = it.kind === 'topic' && (okP.length || noP.length) ? [] : (it.photos || []).slice(0, 3)
        return (
          <div className="rpt-keep rpt-sp" key={idx}>
            <div className="rpt-sp-h"><span className="rpt-sp-n">{idx + 1}</span><b>{it.title}</b><span className="rpt-sp-tag">{it.source}</span></div>
            {it.meta && <p className="rpt-mut">{it.meta}</p>}
            {photos.length > 0 && <div className="rpt-ph3">{photos.map((p, k) => <img key={k} src={p} alt="" />)}</div>}
            {c && (
              <div className="rpt-two">
                <div className="rpt-box"><h4>客人反映／實際原因</h4><p>{c.guest_comment}</p>{c.actual_cause && <p className="rpt-red">{c.actual_cause}</p>}</div>
                <div className="rpt-box"><h4>✓ 正確標準</h4><p>{c.correct_standard || '—'}</p>{c.improvement && <p><b>改善：</b>{c.improvement}</p>}</div>
              </div>
            )}
            {t && (
              <>
                {t.why && <p>{t.why}</p>}
                <div className="rpt-two">
                  <div className="rpt-box"><h4>✓ 正確做法</h4>{list(t.correct_steps) || <p>—</p>}{okP.length > 0 && <div className="rpt-ph3">{okP.map((p, k) => <img key={k} src={p} alt="" />)}</div>}</div>
                  <div className="rpt-box"><h4>✗ 常見錯誤</h4>{bul(t.mistakes) || <p>—</p>}{noP.length > 0 && <div className="rpt-ph3">{noP.map((p, k) => <img key={k} src={p} alt="" />)}</div>}</div>
                </div>
              </>
            )}
            {!t && !c && it.kind === 'finding' && (
              <div className="rpt-q"><b>討論</b>　這類問題為甚麼會發生？正確做法是什麼？請同事講一次，主管補充。</div>
            )}
            {!t && !c && it.kind === 'good' && (
              <div className="rpt-q"><b>表揚</b>　請做得好的同事分享做法，其他同事學習。</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 後勤清單報告（跟目前分頁與篩選）──
export function ListReport({ data }) {
  const { filterText, cols, groups } = data
  const [withPhotos, setWithPhotos] = useState(true)
  const total = groups.reduce((n, g) => n + g.rows.length, 0)
  const hasPhoto = groups.some(g => g.rows.some(r => r.photo))
  const showPh = withPhotos && hasPhoto
  return (
    <>
      <p className="rpt-mut">篩選：{filterText}　·　共 {total} 項</p>
      {hasPhoto && <label className="rpt-noprint rpt-check"><input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} /> 附上相片</label>}
      {total === 0 && <Empty>沒有符合篩選的項目</Empty>}
      {groups.map(g => (
        <div key={g.name}>
          <Sub>{g.name} · {g.rows.length}</Sub>
          <table className="rpt-t">
            <thead><tr>{showPh && <th style={{ width: 56 }}></th>}{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={i}>
                  {showPh && <td>{r.photo ? <img className="rpt-th" src={r.photo} alt="" /> : null}</td>}
                  {r.cells.map((c, k) => <td key={k} className={(r.cls && r.cls[k]) || ''}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
