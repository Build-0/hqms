import { SCORE_DIMS, SCORE_MAX } from '../data/seedData'

// 人員表現：由查房記錄自動推算（取代原本手動評分）
// 規則：近 30 日內，每人七項各 5 分起；每個「有問題」標籤扣 1 分（扣在該標籤所屬項目，最低 1 分）；
//      每一次「做得好」令總分 +1（上限 35）；未歸類的問題（其他、漏做項目）只計次數、不影響七項。
export const PERF_DAYS = 30
export const LEVELS = [
  { key: '優良', min: 28, color: '#1b8a5a' },
  { key: '一般', min: 21, color: '#2f6fba' },
  { key: '需注意', min: 18, color: '#e69500' },
  { key: '立刻培訓', min: 0, color: '#c62828' },
]
export const levelOf = n => LEVELS.find(l => n >= l.min)
export const WEAK = 2
export { SCORE_DIMS, SCORE_MAX }

const goodKind = f => String(f.batch || '').startsWith('good-')

// rows：查房記錄；sinceStr：起始日期（含）；回傳 Map<attendant_id, 表現>
export function computePerf(rows, tagById, sinceStr) {
  const map = new Map()
  const get = id => {
    if (!map.has(id)) map.set(id, { dims: Object.fromEntries(SCORE_DIMS.map(k => [k, 5])), issueN: 0, otherN: 0, goodBatches: new Set(), last: '', issues: [], goods: [] })
    return map.get(id)
  }
  for (const f of rows) {
    if (!f.attendant_id || f.date < sinceStr) continue
    const p = get(f.attendant_id)
    if (f.date > p.last) p.last = f.date
    const name = (tagById[f.tag_id] || {}).name || f.tag
    if (goodKind(f)) { p.goodBatches.add(f.batch); p.goods.push({ date: f.date, name, time: f.check_time, insp: f.inspector, batch: f.batch }); continue }
    p.issueN++
    p.issues.push({ date: f.date, name, room: f.room, time: f.check_time, insp: f.inspector, batch: f.batch })
    const dim = (tagById[f.tag_id] || {}).dim
    if (SCORE_DIMS.includes(dim)) p.dims[dim] = Math.max(1, p.dims[dim] - 1)
    else p.otherN++
  }
  for (const p of map.values()) {
    const base = SCORE_DIMS.reduce((t, k) => t + p.dims[k], 0)
    p.goodN = p.goodBatches.size
    p.total = Math.min(SCORE_MAX, base + p.goodN)
    p.weak = SCORE_DIMS.filter(k => p.dims[k] <= WEAK)
    p.level = levelOf(p.total)
  }
  return map
}
