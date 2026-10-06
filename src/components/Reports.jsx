import { createPortal } from 'react-dom'
import { todayStr } from '../lib/dates'

// 報告外殼：全螢幕預覽 + 「儲存為 PDF」（瀏覽器列印 → 另存 PDF；手機用分享 → 列印/存成 PDF）
export function ReportModal({ title, sub, onClose, children }) {
  const now = new Date()
  const stamp = `${todayStr()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return createPortal(
    <div className="rpt-overlay">
      <div className="rpt-bar">
        <button className="rpt-btn ghost" onClick={onClose}>‹ 返回</button>
        <span className="rpt-bar-t">報告預覽</span>
        <button className="rpt-btn" onClick={() => window.print()}>儲存為 PDF</button>
      </div>
      <div className="rpt-scroll">
        <div className="rpt-print">
          <div className="rpt-hd"><b>{title}</b><span>{sub}</span></div>
          {children}
          <div className="rpt-ft"><span>HQMS 房務品質管理系統</span><span>匯出時間 {stamp}</span></div>
        </div>
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
  const { ratedN, totalN, max, levels, dimWeak, follow } = data
  return (
    <>
      <p className="rpt-mut">已評 {ratedN} / {totalN} 人 · 滿分 {max}</p>
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
  return (
    <>
      <p className="rpt-mut">客房投訴 {inv} 單 · 濫訴 {ab} 單 · 工程與其他 {eng} 單 · 合計 {total} 單</p>
      <div className="rpt-two">
        <div><Sub>分類排行（客房投訴）</Sub>{rank.length ? <Bars rows={rank.map(r => ({ k: r.cat, n: r.n }))} color="#1f7a6d" /> : <Empty />}</div>
        <div><Sub>樓層分佈（客房投訴）</Sub>{floorRank.length ? <Bars rows={floorRank.map(([f, n]) => ({ k: f === '無房號' ? f : `${f} 樓`, n }))} /> : <Empty />}</div>
      </div>
      <Sub>客訴明細</Sub>
      {rows.length === 0 ? <Empty>本月沒有記錄</Empty> : (
        <table className="rpt-t">
          <thead><tr><th>日期</th><th>房號</th><th>分類</th><th>客人反映</th><th>改善措施</th></tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i}>
                <td className="rpt-nw">{c.date.slice(5)}</td><td className="rpt-nw">{c.room}</td>
                <td>{c.category}{c.tag ? <span className="rpt-mut"> · {c.tag}</span> : ''}</td>
                <td>{c.guest_comment}</td><td>{c.improvement || '—'}</td>
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
    const q = c ? `昨日 ${c.room} 房的投訴是什麼？我們的正確標準是？` : t.question
    const a = c ? `${c.guest_comment}。正確標準：${c.correct_standard || '—'}` : t.answer
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
        {(c ? c.improvement : t.supervisor_check) && <p><b>主管重點檢查：</b>{c ? c.improvement : t.supervisor_check}</p>}
        {q && <div className="rpt-q"><b>早會提問</b><br />問：{q}<br /><span className="rpt-mut">答：{a}</span></div>}
      </div>
    )
  })
}

// ── 培訓主題庫 ──
export function TopicsReport({ groups, total }) {
  return (
    <>
      <p className="rpt-mut">共 {total} 個主題 · {groups.length} 個分類</p>
      {groups.map(g => (
        <div key={g.name}>
          <Sub>{g.name} · {g.items.length} 個主題</Sub>
          {g.items.length === 0 ? <Empty>沒有主題</Empty> : (
            <table className="rpt-t">
              <thead><tr><th style={{ width: '26%' }}>主題</th><th>正確做法</th><th style={{ width: '30%' }}>常見錯誤</th></tr></thead>
              <tbody>
                {g.items.map(t => (
                  <tr key={t.id}>
                    <td><b>{t.title}</b></td>
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
  const { daily, spot, cycle, deep } = data
  const tbl = (rows, withWrong) => (
    <table className="rpt-t">
      <thead><tr><th style={{ width: '22%' }}>類別</th><th>項目</th>{withWrong && <th style={{ width: '34%' }}>常見錯誤</th>}</tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={i}><td>{[r.grp, r.area].filter(Boolean).join(' · ') || '—'}</td><td>{r.text}</td>{withWrong && <td>{r.wrong || '—'}</td>}</tr>)}
      </tbody>
    </table>
  )
  return (
    <>
      <Sub>每日清潔 · {daily.length} 項</Sub>{daily.length ? tbl(daily, true) : <Empty />}
      <Sub>常見錯誤／衛生點 · {spot.length} 項</Sub>{spot.length ? tbl(spot, true) : <Empty />}
      <Sub>循環清潔（每月排程）· {cycle.length} 項</Sub>
      {cycle.length ? (
        <table className="rpt-t">
          <thead><tr><th style={{ width: '16%' }}>日期</th><th>項目</th></tr></thead>
          <tbody>{cycle.map((r, i) => <tr key={i}><td className="rpt-nw">{r.day ? `每月 ${r.day} 號` : '不定期'}</td><td>{r.text}</td></tr>)}</tbody>
        </table>
      ) : <Empty />}
      <Sub>深度清潔 · {deep.length} 項</Sub>{deep.length ? tbl(deep, false) : <Empty />}
    </>
  )
}
