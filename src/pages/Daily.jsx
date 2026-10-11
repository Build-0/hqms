import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { DEFAULT_CATEGORIES } from '../data/seedData'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { ReportModal, SpeechSheet } from '../components/Reports'
import { canExport } from '../lib/accounts'

const isCore = c => (c.dept || (c.nature === '工程投訴' ? '工程其他' : '客房')) === '客房'
  && (c.nature === '工程投訴' ? '投訴' : (c.nature || '投訴')) === '投訴'

// 早會「今日講 3 件事」卡：預設只見標題、相片、一句重點；撳開先見詳情
function TalkCard({ n, it, open, onToggle }) {
  const [showA, setShowA] = useState(false)
  const t = it.topic, c = it.complaint
  const key = c ? (c.correct_standard || c.guest_comment) : t ? ((t.correct_steps || [])[0] || t.why) : ''
  const tag = it.kind === 'complaint' ? { t: '昨日客訴', cls: 'b-red' } : it.kind === 'finding' ? { t: it.meta, cls: 'b-red' } : { t: '補位', cls: 'b-gray' }
  const photos = (it.photos || []).slice(0, open ? 4 : 2)
  const q = c ? `昨日 ${c.room} 房的投訴是什麼？我們的正確標準是？` : t?.question
  const a = c ? `${c.guest_comment}。正確標準：${c.correct_standard || '—'}` : t?.answer
  return (
    <div className={`tk ${open ? 'open' : ''}`}>
      <button className="tk-h" onClick={onToggle}>
        <span className="tk-n">{n}</span>
        <span className="tk-t"><b>{it.title}</b><span className={`badge ${tag.cls}`}>{tag.t}</span></span>
        <span className="tk-x">{open ? '－' : '＋'}</span>
      </button>
      {photos.length > 0 && <div className="tk-ph">{photos.map((p, i) => <img key={i} src={p} alt="" loading="lazy" />)}</div>}
      {key && <p className="tk-key"><span>標準</span>{key}</p>}
      {!key && it.kind === 'finding' && <p className="tk-key" style={{ color: 'var(--sub)' }}><span style={{ background: 'var(--bg)', color: 'var(--sub)' }}>討論</span>請同事講返正確做法，主管補充</p>}
      {open && (
        <div className="tk-b">
          {c && (
            <>
              <p className="tk-l"><b>客人反映：</b>{c.guest_comment}（{c.room} 房）</p>
              {c.actual_cause && <p className="tk-l"><b>實際原因：</b>{c.actual_cause}</p>}
              {c.improvement && <p className="tk-l"><b>主管重點檢查：</b>{c.improvement}</p>}
            </>
          )}
          {t && (
            <>
              {t.why && <p className="tk-l">{t.why}</p>}
              {(t.correct_steps || []).length > 0 && <div className="tk-sec ok"><b>✓ 正確做法</b><ol>{t.correct_steps.map((x, i) => <li key={i}>{x}</li>)}</ol></div>}
              {(t.mistakes || []).length > 0 && <div className="tk-sec no"><b>✗ 常見錯誤</b><ul>{t.mistakes.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {t.supervisor_check && <p className="tk-l"><b>主管重點檢查：</b>{t.supervisor_check}</p>}
            </>
          )}
          {!t && !c && <p className="tk-l">這類問題為甚麼會發生？正確做法是什麼？請同事講一次，主管補充。</p>}
          {q && (
            <div className="tk-q"><b>早會提問</b>　{q}
              {showA ? <div className="tk-a">答：{a}</div> : <button className="a-btn" onClick={() => setShowA(true)}>顯示答案</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Daily() {
  const [st, setSt] = useState(null)

  const [err, setErr] = useState('')
  const [report, setReport] = useState(false)   // 顯示講稿
  const [pick, setPick] = useState(false)       // 揀講稿內容
  const [sel, setSel] = useState([])
  const [tq, setTq] = useState('')
  const [open, setOpen] = useState('')           // 展開中的講稿卡（一次只開一張）
  useEffect(() => { load() }, [])

  async function load() {
    try { await loadFocus(); setErr('') } catch (ex) { setErr(ex.message) }
  }

  async function loadFocus() {
    const today = todayStr()
    const yesterday = addDaysStr(-1)
    const [complaints, topics, kk] = await Promise.all([api.listComplaints(), api.listTopics(), api.listCategories()])
    const cats = kk?.length ? kk : DEFAULT_CATEGORIES
    const ycs = complaints.filter(c => c.date === yesterday && isCore(c))
    const pick = n => (topics.length ? topics[(Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000) + n) % topics.length] : null)

    // 近 7 日查房記錄 → 最常見問題、做得好（今日重點的主要來源）
    const digest = { top: [], good: [], topTopicIds: [] }
    try {
      const [fr, ft] = await Promise.all([api.listFindings(addDaysStr(-6)), api.listFindingTags()])
      const tagById = Object.fromEntries(ft.map(t => [t.id, t]))
      const floorOf = r => { const m = String(r || '').replace(/\D/g, ''); return m.length >= 4 ? m.slice(0, m.length - 2) : m.length === 3 ? m[0] : '' }
      const group = rows => {
        const g = {}
        for (const f of rows) {
          const name = (tagById[f.tag_id] || {}).name || f.tag
          if (!name) continue
          const o = (g[name] = g[name] || { name, n: 0, floors: new Set(), photos: [], topic_id: (tagById[f.tag_id] || {}).topic_id || null })
          o.n++
          const fl = floorOf(f.room); if (fl) o.floors.add(fl)
          for (const p of f.photos || []) if (o.photos.length < 3) o.photos.push(p)
        }
        return Object.values(g).sort((a, b) => b.n - a.n).map(o => ({ ...o, floors: [...o.floors].sort((a, b) => a - b) }))
      }
      const isGood = f => String(f.batch || '').startsWith('good-')
      digest.top = group(fr.filter(f => !isGood(f) && f.tag !== '其他')).slice(0, 3)
      digest.good = group(fr.filter(isGood)).slice(0, 3)
      digest.topTopicIds = [...new Set(digest.top.map(t => t.topic_id).filter(Boolean))]
    } catch { /* 查房資料不可用時，照舊選題 */ }

    let focus = await api.getFocus(today)
    if (!focus) {
      const s1 = ycs[0]
        ? { source: 'complaint', complaint_id: ycs[0].id, topic_id: null }
        : (digest.topTopicIds[0] ? { source: 'topic', topic_id: digest.topTopicIds[0], complaint_id: null } : pick(0) ? { source: 'topic', topic_id: pick(0).id, complaint_id: null } : null)
      if (s1) {
        // 第二主題：第二宗昨日客訴，否則輪替另一個主題
        let s2 = null
        if (ycs[1]) s2 = { source2: 'complaint', complaint_id2: ycs[1].id, topic_id2: null }
        else {
          const wanted = digest.topTopicIds[s1.source === 'topic' ? 1 : 0]
          const t2 = (wanted && topics.find(t => t.id === wanted)) || (s1.source === 'topic' ? pick(1) : pick(0))
          if (t2 && t2.id !== s1.topic_id) s2 = { source2: 'topic', topic_id2: t2.id, complaint_id2: null }
        }
        try {
          focus = await api.setFocus({ focus_date: today, ...s1, ...(s2 || {}) })
        } catch {
          focus = await api.setFocus({ focus_date: today, ...s1 }) // source2 欄未建立時退回單主題
        }
      }
    } else if ('source2' in focus && !focus.source2 && topics.length > 1) {
      // 手動指定過第一主題的日子，自動補第二主題
      const used = focus.source === 'topic' ? focus.topic_id : null
      let t2 = pick(1)
      if (t2 && t2.id === used) t2 = pick(2)
      if (t2 && t2.id !== used) {
        try { focus = await api.patchFocus(today, { source2: 'topic', topic_id2: t2.id, complaint_id2: null }) } catch {}
      }
    }

    const resolve = (src, cid, tid) => ({
      complaint: src === 'complaint' ? complaints.find(c => c.id === cid) : null,
      topic: src === 'topic' ? topics.find(t => t.id === tid) : null,
    })
    const s1 = focus ? resolve(focus.source, focus.complaint_id, focus.topic_id) : null
    const s2 = focus?.source2 ? resolve(focus.source2, focus.complaint_id2, focus.topic_id2) : null

    const tf = await api.getFocus(addDaysStr(1))
    let tomorrowName = null
    if (tf) {
      tomorrowName = tf.source === 'complaint'
        ? `客訴案例（${complaints.find(c => c.id === tf.complaint_id)?.room ?? '?'} 房）`
        : topics.find(t => t.id === tf.topic_id)?.title
    }
    setSt({ focus, s1, s2, cats, tomorrowName, hadYesterday: ycs.length > 0, digest, topics })
  }

  async function share() {
    await api.markShared(todayStr())
    load()
  }

  async function regen() {
    await api.clearFocus(todayStr())
    await load()
    toast('已重新選題')
  }

  if (err && !st) return <div className="card"><p className="src-note">讀取失敗：{err}</p><button className="btn" onClick={load}>重試</button></div>
  if (!st) return <div className="note">載入中…</div>
  const { focus, s1, s2, tomorrowName, digest } = st
  const allTopics = st.topics || []
  const slots = [s1, s2].filter(s => s && (s.complaint || s.topic))

  if (!focus || slots.length === 0) {
    return (
      <div className="daily-wrap">
      <div className="card">
        <h2>今日暫無品質重點</h2>
        <p className="src-note">主題庫還沒有內容，或原本的重點已被刪除。</p>
        {focus && <button className="btn" onClick={regen}>重新選題</button>}
      </div>
      </div>
    )
  }

  const cands = []
  slots.forEach((sl, i) => {
    if (sl.complaint) cands.push({ key: 'f' + i, group: '今日重點', kind: 'complaint', source: '昨日客訴', title: `昨日客訴 · ${sl.complaint.room} 房`, complaint: sl.complaint, photos: sl.complaint.photos })
    else if (sl.topic) cands.push({ key: 'f' + i, group: '今日重點', kind: 'topic', source: sl.topic.category, title: sl.topic.title, topic: sl.topic, photos: sl.topic.photos })
  })
  digest.top.forEach(t => cands.push({ key: 'd:' + t.name, group: '近 7 日查房常見問題', kind: 'finding', source: '查房記錄', title: t.name, meta: `近 7 日 ${t.n} 次${t.floors.length ? ' · 涉及樓層：' + t.floors.map(f => f + ' 樓').join('、') : ''}`, topic: allTopics.find(x => x.id === t.topic_id), photos: t.photos }))
  digest.good.forEach(t => cands.push({ key: 'g:' + t.name, group: '近 7 日做得好', kind: 'good', source: '做得好', title: t.name, meta: `近 7 日 ${t.n} 次`, photos: t.photos }))
  allTopics.forEach(t => cands.push({ key: 't:' + t.id, group: '主題庫 · ' + t.category, kind: 'topic', source: t.category, title: t.title, topic: t, photos: t.photos }))
  const picked = sel.map(k => cands.find(c => c.key === k)).filter(Boolean)
  const MAXI = 3
  const toggle = k => setSel(a => (a.includes(k) ? a.filter(x => x !== k) : a.length >= MAXI ? a : [...a, k]))
  const tqs = tq.trim().toLowerCase()
  const visible = cands.filter(c => !c.key.startsWith('t:') || !tqs || (c.title + c.source).toLowerCase().includes(tqs))
  const groups = [...new Set(visible.map(c => c.group))]
  const openPick = () => { if (!canExport()) setReport(true); else setPick(true) }

  const MAXT = 3
  const talk = []
  const seenTopic = new Set()
  slots.filter(sl => sl.complaint).forEach(sl => { if (talk.length < MAXT) talk.push({ key: 'c' + sl.complaint.id, kind: 'complaint', title: `${sl.complaint.room} 房客訴：${(sl.complaint.guest_comment || '').slice(0, 24)}`, complaint: sl.complaint, photos: sl.complaint.photos }) })
  digest.top.forEach(t => {
    if (talk.length >= MAXT) return
    const tp = allTopics.find(x => x.id === t.topic_id)
    if (tp) seenTopic.add(tp.id)
    talk.push({ key: 'd' + t.name, kind: 'finding', title: t.name, meta: `查房 ${t.n} 次${t.floors.length ? ' · ' + t.floors.map(f => f + '樓').join('、') : ''}`, topic: tp, photos: t.photos })
  })
  slots.filter(sl => sl.topic && !seenTopic.has(sl.topic.id)).forEach(sl => { if (talk.length < MAXT) { seenTopic.add(sl.topic.id); talk.push({ key: 't' + sl.topic.id, kind: 'topic', title: sl.topic.title, topic: sl.topic, photos: sl.topic.photos }) } })
  const shared = !!focus.shared_at
  return (
    <div className="daily-wrap">
      <div className="dy-head">
        <h2>今日講 {talk.length} 件事</h2>
        <span>{todayStr().slice(5).replace('-', '月')}日　約 5 分鐘</span>
      </div>
      {talk.map((it, i) => <TalkCard key={it.key} n={i + 1} it={it} open={open === it.key} onToggle={() => setOpen(open === it.key ? '' : it.key)} />)}
      {digest.good.length > 0 && (
        <div className="dy-good">
          <b>⭐ 近 7 日做得好，可以表揚</b>
          {digest.good.map(g => <span key={g.name}>{g.name}（{g.n} 次{g.floors.length ? ' · ' + g.floors.map(f => f + '樓').join('、') : ''}）</span>)}
        </div>
      )}

      {pick && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setPick(false) }}>
          <div className="sheet">
            <h2>匯出早會講稿</h2>
            <p className="src-note">揀最多 {MAXI} 項（已揀 {sel.length}/{MAXI}），列印成一張紙。有相片的會一齊印出，早會沒有特別事項時，可以照住這張紙講。</p>
            <input className="search-inp" placeholder="🔍 搜尋主題庫" value={tq} onChange={e => setTq(e.target.value)} />
            {groups.map(g => (
              <div key={g}>
                <div className="sp-grp">{g}</div>
                {visible.filter(c => c.group === g).map(c => {
                  const on = sel.includes(c.key), full = !on && sel.length >= MAXI
                  return (
                    <label key={c.key} className={`sp-opt ${on ? 'on' : ''} ${full ? 'dim' : ''}`}>
                      <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(c.key)} />
                      <span className="sp-t">{c.title}{c.meta && <small>{c.meta}</small>}</span>
                      {c.photos?.length > 0 && <span className="sp-ph">📷{c.photos.length}</span>}
                    </label>
                  )
                })}
              </div>
            ))}
            <button className="btn" disabled={sel.length === 0} onClick={() => { setPick(false); setReport(true) }}>預覽並匯出（{sel.length} 項）</button>
            <button className="btn ghost" onClick={() => setPick(false)}>取消</button>
          </div>
        </div>
      )}
      {report && (
        <ReportModal title="早會講稿" sub={todayStr()} onClose={() => setReport(false)}>
          <SpeechSheet items={picked} />
        </ReportModal>
      )}
      <button className={`done-btn ${shared ? 'done' : ''}`} onClick={shared ? undefined : share}>
        {shared
          ? `✓ 已於早會分享（${new Date(focus.shared_at).toTimeString().slice(0, 5)}）`
          : '✓ 標記已於早會分享'}
      </button>

      <div className="dy-foot">
        <button className="btn ghost" onClick={openPick}>📄 匯出早會講稿</button>
        <button className="linky" onClick={regen}>🔄 重新選題</button>
      </div>
      <p className="dy-note">{st.hadYesterday ? '昨日有投訴，已排在最前。' : '優先講近 7 日查房常見問題，不足 3 項才用主題庫補位。'}{tomorrowName ? ` 明日已指定：${tomorrowName}` : ''}</p>
    </div>
  )
}
