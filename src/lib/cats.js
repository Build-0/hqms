// 七大分類的視覺識別：圖示 + 主色 + 淡色，全站統一使用
export const CAT_META = {
  '客房清潔': { e: '🛏️', c: '#1f7a6d', s: '#e2f0ee' },
  '浴室':     { e: '🚿', c: '#4a6fa5', s: '#e8eef6' },
  '服務':     { e: '🛎️', c: '#b07d2e', s: '#f6efe2' },
  '安全':     { e: '⛑️', c: '#c0564f', s: '#f7e8e6' },
  '遺留物':   { e: '🎒', c: '#8f7ac9', s: '#ece7f6' },
  '工具':     { e: '🧰', c: '#54808c', s: '#e3edf0' },
  '工作間':   { e: '🧺', c: '#5f9e63', s: '#e7f2e8' },
}
export const catMeta = c => CAT_META[c] || { e: '📋', c: '#7a8894', s: '#eef1f4' }
