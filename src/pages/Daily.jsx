import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'

const CAT_EN = { 客房清潔: 'Room Cleaning', 浴室: 'Bathroom', 服務: 'Guest Service', 安全: 'Safety', 遺留物: 'Lost & Found', 工具: 'Equipment', 工作間: 'Work Area' }

export default function Daily() {
  const [st, setSt] = useState(null)
  const [showA, setShowA] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const today = todayStr()
    const yesterday = addDaysStr(-1)
    const [complaints, topics] = await Promise.all([api.listComplaints(), api.listTopics()])
    let focus = await api.getFocus(today)
    if (!focus) {
      const yc = complaints.find(c => c.date === yesterday)
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
    setSt({ focus, complaint, topic, tomorrowName, hadYesterday: complaints.some(c => c.date === yesterday) })
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
  const title = isC ? `客訴改善：${complaint.guest_comment}` : topic.title
  const q = isC ? `昨日 ${complaint.room} 房嘅投訴係咩？我哋嘅正確標準係點？` : topic.question
  const a = isC ? `${complaint.guest_comment}。正確標準：${complaint.correct_standard}` : topic.answer
  const shared = !!focus.shared_at

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className={`badge ${isC ? 'b-red' : 'b-teal'}`}>{isC ? '來源：昨日客訴' : '來源：主題輪替'}</span>
          <span style={{ fontSize: 11, color: 'var(--sub)' }}>早會 2–5 分鐘</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 4 }}>今日品質重點 · {cat} {CAT_EN[cat] || ''}</div>
        <h2 style={{ fontSize: 18 }}>{title}</h2>
        <div className="sec">
          {isC ? (
            <>
              <h3>發生咗咩事</h3>
              <p>{complaint.date} · {complaint.room} 房，客人反映：「{complaint.guest_comment}」</p>
              {complaint.actual_cause && <><h3>實際原因</h3><p>{complaint.actual_cause}</p></>}
              {complaint.correct_standard && <><h3>正確標準</h3><p>{complaint.correct_standard}</p></>}
              {complaint.improvement && (
                <>
                  <h3>今日主管重點檢查</h3>
                  <div className="check-item"><span className="dot">✓</span>{complaint.improvement}</div>
                  <div className="check-item"><span className="dot">✓</span>{complaint.room} 房今日必查並跟進</div>
                </>
              )}
              <div className="quote">「每一宗客訴，都係聽日唔再發生嘅開始。」</div>
            </>
          ) : (
            <>
              <h3>為什麼重要</h3>
              <p>{topic.why}</p>
              {topic.correct_steps?.length > 0 && (
                <><h3>正確做法</h3><ul>{topic.correct_steps.map((x, i) => <li key={i}>{x}</li>)}</ul></>
              )}
              {topic.mistakes?.length > 0 && (
                <><h3>常見錯誤</h3><ul>{topic.mistakes.map((x, i) => <li key={i}>{x}</li>)}</ul></>
              )}
              {topic.supervisor_check && (
                <><h3>今日主管重點檢查</h3>
                  <div className="check-item"><span className="dot">✓</span>{topic.supervisor_check}</div></>
              )}
              {topic.reminder && <div className="quote">{topic.reminder}</div>}
            </>
          )}
          {q && (
            <div className="qa">
              <div className="q-label">早會提問 · 加強記憶</div>
              <div className="q-text">問：{q}</div>
              {showA
                ? <div className="a-text"><b>答：</b>{a}</div>
                : <button className="a-btn" onClick={() => setShowA(true)}>顯示答案</button>}
              <div className="q-hint">早會時隨機抽問 1–2 位同事，答唔出唔緊要，即場講一次正確答案。</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <button className={`done-btn ${shared ? 'done' : ''}`} onClick={shared ? undefined : share}>
            {shared
              ? `✓ 已於早會分享（${new Date(focus.shared_at).toTimeString().slice(0, 5)}）`
              : '✓ 標記已於早會分享'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '13px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 6 }}>選題邏輯（自動）</div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          {st.hadYesterday ? <>昨日有客訴 → 以客訴為今日重點 ✅<br /></> : <>昨日無客訴 → 按主題庫輪替 ✅<br /></>}
          <span style={{ color: 'var(--sub)' }}>
            {tomorrowName ? `明日重點已指定：${tomorrowName}` : '明日：有客訴用客訴，否則主題輪替（可在客訴/主題頁手動指定）'}
          </span>
        </div>
        <button className="btn ghost" style={{ marginTop: 6 }} onClick={regen}>🔄 今日重新選題</button>
      </div>
    </>
  )
}
