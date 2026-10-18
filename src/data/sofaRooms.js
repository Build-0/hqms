// 大床梳化檢查總表的房間名單：4–10 樓；大床房 + 套房（02、33、37、69、77、79、81）；38、40、71 沒有梳化，已剔除
const ALL = '01.02.03.05.06.08.11.13.18.20.30.33.35.36.38.40.46.48.52.63.65.66.67.68.71.75'.split('.')
export const SOFA_FLOORS = [4, 5, 6, 7, 8, 9, 10]
const SUITE_NO = ['02', '33', '37', '69', '77', '79', '81']   // 套房：每層都有 7 間
const NO_SOFA = ['38', '40', '71']   // 這三個房號每層都沒有梳化，不列入總表
const BIG = ALL.filter(r => !SUITE_NO.includes(r) && !NO_SOFA.includes(r))   // 純大床房
const SUITES = SOFA_FLOORS.flatMap(f => SUITE_NO.map(r => `${f}${r}`))

export const SOFA_ROOMS = [
  ...SOFA_FLOORS.flatMap(f => BIG.map(r => ({ room: `${f}${r}`, floor: f, suite: false }))),
  ...SUITES.map(r => ({ room: r, floor: parseInt(r.slice(0, -2), 10), suite: true })),
].sort((a, b) => a.floor - b.floor || a.room.localeCompare(b.room, undefined, { numeric: true }))

export const SOFA_TYPE = /大床梳化|梳化甩皮/   // 缺陷類型名稱「5.大床梳化甩皮」
