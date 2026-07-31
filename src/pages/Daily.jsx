import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { metaOf } from '../lib/cats'
import { DEFAULT_CATEGORIES } from '../data/seedData'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid } from '../components/Photos'

const isCore = c => (c.dept || (c.nature === '工程投訴' ? '工程其他' : '客房')) === '客房'
  && (c.nature === '工程投訴' ? '投訴' : (c.nature || '投訴')) === '投訴'

// 摺疊區塊：預設收起，早會講到哪段點開哪段
function Sec({ icon, color, title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="dsec">
      <div className="dsec-h" onClick={() => setOpen(!open)}>
        <span className="ic" style={{ color }}>{icon}</span>
        <span style={{ flex: 1 }}>{title}{count != null && <span className="cnt">（{count} 項）</span>}</span>
        <span style={{ color: 'var(--sub)', fontWeight: 400 }}>{open ? '－' : '＋'}</span>
      </div>
      {open && <div className="dsec-b">{children}</div>}
    </div>
  )
}

// 單個重點卡（客訴或主題）
function FocusCard({ label, complaint, topic, cats }) {
  const [showA, setShowA] = useState(false)
  const isC = !!complaint
  const cat = isC ? complaint.category : topic.category
  const m = metaOf(cats, cat)
  const title = isC ? `客訴改善：${complaint.guest_comment}` : topic.title
  const q = isC ? `昨日 ${complaint.room} 房的投訴是什麼？我們的正確標準是？` : topic.question
  const a = isC ? `${complaint.guest_comment}。正確標準：${complaint.correct_standard}` : topic.answer
  const photos = isC ? complaint.photos : topic.photos

  return (
    <div className="card">
      <div className="hero" style={{ background: m.s }}>
        <div className="hero-e" style={{ fontSize: 36 }}>{m.e}</div>
        <div>
          <div className="badges">
            {label && <span className="badge" style={{ background: 'var(--ink)', color: '#fff' }}>{label}</span>}
            <span className={`badge ${isC ? 'b-red' : 'b-teal'}`}>{isC ? '昨日客訴' : '主題輪替'}</span>
            <span className="badge" style={{ background: '#fff', color: m.c }}>{cat}</span>
          </div>
          <h2 style={{ fontSize: 17, margin: '4px 0 0' }}>{title}</h2>
        </div>
      </div>

      <p className="lead" style={{ margin: '12px 2px 2px' }}>
        {isC
          ? <>{complaint.date} · <b>{complaint.room} 房</b>，客人反映：「{complaint.guest_comment}」</>
          : topic.why}
      </p>
      <PhotoGrid photos={photos} />

      {isC ? (
        <>
          <Sec icon="✓" color="var(--accent)" title="正確標準與原因" defaultOpen>
            {complaint.actual_cause && <div className="bad-item"><span className="x">✗</span>{complaint.actual_cause}</div>}
            {complaint.correct_standard && <div className="step"><span className="n">✓</span>{complaint.correct_standard}</div>}
            {!complaint.actual_cause && !complaint.correct_standard && <div className="check-item"><span className="dot">›</span>尚未填寫，點客訴記錄補充「實際原因／正確標準」</div>}
          </Sec>
          {complaint.improvement && (
            <Sec icon="👁" color="var(--blue)" title="今日主管重點檢查">
              <div className="check-item"><span className="dot">✓</span>{complaint.improvement}</div>
              <div className="check-item"><span className="dot">✓</span>{complaint.room} 房今日必查並跟進</div>
            </Sec>
          )}
        </>
      ) : (
        <>
          {topic.correct_steps?.length > 0 && (
            <Sec icon="✓" color="var(--accent)" title="正確做法" count={topic.correct_steps.length} defaultOpen>
              {topic.correct_steps.map((x, i) => <div className="step" key={i}><span className="n">{i + 1}</span>{x}</div>)}
            </Sec>
          )}
          {topic.mistakes?.length > 0 && (
            <Sec icon="✗" color="var(--red)" title="常見錯誤" count={topic.mistakes.length}>
              {topic.mistakes.map((x, i) => <div className="bad-item" key={i}><span className="x">✗</span>{x}</div>)}
            </Sec>
          )}
          {topic.supervisor_check && (
            <Sec icon="👁" color="var(--blue)" title="今日主管重點檢查">
              <div className="check-item"><span className="dot">✓</span>{topic.supervisor_check}</div>
            </Sec>
          )}
        </>
      )}

      {q && (
        <Sec icon="🎤" color="var(--amber)" title="早會提問">
          <div className="q-text" style={{ fontSize: 13.5 }}>問：{q}</div>
          {showA
            ? <div className="a-text" style={{ borderColor: 'var(--line)' }}><b>答：</b>{a}</div>
            : <button className="a-btn" onClick={() => setShowA(true)}>顯示答案</button>}
          <div className="q-hint">隨機抽問 1–2 位同事，答不出就當場講一次正確答案。</div>
        </Sec>
      )}

      {(isC ? true : !!topic.reminder) && (
        <div className="quote" style={{ marginTop: 12 }}>
          {isC ? '「每一宗客訴，都是明天不再發生的開始。」' : topic.reminder}
        </div>
      )}
    </div>
  )
}

export default function Daily() {
  const [st, setSt] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const today = todayStr()
    const yesterday = addDaysStr(-1)
    const [complaints, topics, kk] = await Promise.all([api.listComplaints(), api.listTopics(), api.listCategories()])
    const cats = kk?.length ? kk : DEFAULT_CATEGORIES
    const ycs = complaints.filter(c => c.date === yesterday && isCore(c))
    const pick = n => (topics.length ? topics[(Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000) + n) % topics.length] : null)

    let focus = await api.getFocus(today)
    if (!focus) {
      const s1 = ycs[0]
        ? { source: 'complaint', complaint_id: ycs[0].id, topic_id: null }
        : (pick(0) ? { source: 'topic', topic_id: pick(0).id, complaint_id: null } : null)
      if (s1) {
        // 第二主題：第二宗昨日客訴，否則輪替另一個主題
        let s2 = null
        if (ycs[1]) s2 = { source2: 'complaint', complaint_id2: ycs[1].id, topic_id2: null }
        else {
          const t2 = s1.source === 'topic' ? pick(1) : pick(0)
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
    setSt({ focus, s1, s2, cats, tomorrowName, hadYesterday: ycs.length > 0 })
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

  if (!st) return <div className="note">載入中…</div>
  const { focus, s1, s2, tomorrowName } = st
  const slots = [s1, s2].filter(s => s && (s.complaint || s.topic))

  if (!focus || slots.length === 0) {
    return (
      <div className="card">
        <h2>今日暫無品質重點</h2>
        <p className="src-note">主題庫還沒有內容，或原本的重點已被刪除。</p>
        {focus && <button className="btn" onClick={regen}>重新選題</button>}
      </div>
    )
  }

  const shared = !!focus.shared_at
  return (
    <div className="daily-wrap">
      {slots.map((s, i) => (
        <FocusCard key={i} label={slots.length > 1 ? `重點${['一', '二'][i]}` : null}
          complaint={s.complaint} topic={s.topic} cats={st.cats} />
      ))}

      <button className={`done-btn ${shared ? 'done' : ''}`} onClick={shared ? undefined : share}>
        {shared
          ? `✓ 已於早會分享（${new Date(focus.shared_at).toTimeString().slice(0, 5)}）`
          : '✓ 標記已於早會分享'}
      </button>

      <p className="logic-line">
        📅 {st.hadYesterday ? '昨日有投訴 → 以客訴為重點' : '昨日無投訴 → 主題輪替'}
        {tomorrowName ? ` · 明日已指定：${tomorrowName}` : ''}
        <button className="linky" onClick={regen}>🔄 重新選題</button>
      </p>
    </div>
  )
}
