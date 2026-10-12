// 標題列「‹」返回掣的統一行為：有子層級的頁面登記「返回上一層」，按 ‹ 先返回上一層，最頂層才返回上一個畫面
import { useEffect, useRef } from 'react'

const handlers = new Map()   // level → 函式；level 愈大愈內層，優先執行
export function runBack() {
  const levels = [...handlers.keys()].sort((a, b) => b - a)
  if (!levels.length) return false
  handlers.get(levels[0])()
  return true
}
export function useBack(active, fn, level = 1) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    const h = () => ref.current()
    handlers.set(level, h)
    return () => { if (handlers.get(level) === h) handlers.delete(level) }
  }, [active, level])
}
