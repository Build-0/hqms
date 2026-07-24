export function fmt(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const todayStr = () => fmt(new Date())
export function addDaysStr(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return fmt(d)
}
