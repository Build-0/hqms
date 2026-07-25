import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { metaOf } from '../lib/cats'
import { DEFAULT_CATEGORIES } from '../data/seedData'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid } from '../components/Photos'

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

export default function Daily() {
  const [st, setSt] = useState(null)
  const [showA, setShowA] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const today = todayStr()
    const yesterday = addDaysStr(-1)
    const [complaints, topics, kk] = await Promise.all([api.listComplaints(), api.listTopics(), api.listCategories()])
    let focus = await api.getFocus(today)
    if (!focus) {
      // 只用「投訴」做重點，濫訴不進早會
      const yc = complaints.find(c => c.date === yesterday && c.nature !== '濫訴')
      if (yc) {
        focus = await api.setFocus({ focus_date: today, source: 'complaint', complaint_id: yc.id, topic_id: null })
      } else if (topics.length) {
        const idx = Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000) % topics.length
        focus = await api.setFocus({ focus_date: today, source: 'topic', complaint_id: null, topic_id: topics[idx].id })
      }
    }
    const complaint = focus?.source === 'complaint' ? complaints.find(c => c.id === focus.complaint_id) : null
    const topic = focus?.source === 'topic' ? topics.find(t => t.id === focus.topic_id) : null
    const tf = await api.getFocus(addDaysStr(1))
    let tomorrowName = null
    if (tf) {
      tomorrowName = tf.source === 'complaint'
        ? `客訴案例（${complaints.find(c => c.id === tf.complaint_id)?.room ?? '?'} 房）`
        : topics.find(t => t.id === tf.topic_id)?.title
    }
    setSt({
      focus, complaint, topic, tomorrowName,
      cats: kk?.length ? kk : DEFAULT_CATEGORIES,
      hadYesterday: complaints.some(c => c.date === yesterday && c.nature !== '濫訴'),
    })
  }

  async function share() {
    await api.markShared(todayStr())
    load()
  }

  async function regen() {
    await api.clearFocus(todayStr())
    setShowA(false)
    await load()
    toast('已重新選題')
  }

  if (!st) return <div className="note">載入中…</div>
  const { focus, complaint, topic, tomorrowName } = st

  if (!focus || (!complaint && !topic)) {
    return (
      <div className="card">
        <h2>今日暫無品質重點</h2>
        <p className="src-note">主題庫還沒有內容，或原本的重點已被刪除。</p>
        {focus && <button className="btn" onClick={regen}>重新選題</button>}
      </div>
    )
  }

  const isC = !!complaint
  const cat = isC ? complaint.category : topic.category
  const m = metaOf(st.cats, cat)
  const title = isC ? `客訴改善：${complaint.guest_comment}` : topic.title
  const q = isC ? `昨日 ${complaint.room} 房嘅投訴係咩？我哋嘅正確標準係點？` : topic.question
  const a = isC ? `${complaint.guest_comment}。正確標準：${complaint.correct_standard}` : topic.answer
  const photos = isC ? complaint.photos : topic.photos
  const shared = !!focus.shared_at

  return (
    <>
      <div className="card">
        <div className="hero" style={{ background: m.s }}>
          <div className="hero-e" style={{ fontSize: 36 }}>{m.e}</div>
          <div>
            <div className="badges">
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
            <div className="q-hint">隨機抽問 1–2 位同事，答唔出即場講一次正確答案。</div>
          </Sec>
        )}

        {(isC ? true : !!topic.reminder) && (
          <div className="quote" style={{ marginTop: 12 }}>
            {isC ? '「每一宗客訴，都係聽日唔再發生嘅開始。」' : topic.reminder}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button className={`done-btn ${shared ? 'done' : ''}`} onClick={shared ? undefined : share}>
            {shared
              ? `✓ 已於早會分享（${new Date(focus.shared_at).toTimeString().slice(0, 5)}）`
              : '✓ 標記已於早會分享'}
          </button>
        </div>
      </div>

      <p className="logic-line">
        📅 {st.hadYesterday ? '昨日有投訴 → 以客訴為重點' : '昨日無投訴 → 主題輪替'}
        {tomorrowName ? ` · 明日已指定：${tomorrowName}` : ''}
        <button className="linky" onClick={regen}>🔄 重新選題</button>
      </p>
    </>
  )
}
