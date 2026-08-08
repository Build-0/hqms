// 統一線條圖標（風格 C：柔和粗描）。用於首頁圓形入口與各子入口。
const PATHS = {
  // 主模組
  focus: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3" /><path d="M12 1.6V4M12 20v2.4M1.6 12H4M20 12h2.4" /></>,
  chat: <><path d="M5 5h14a1.6 1.6 0 0 1 1.6 1.6v7A1.6 1.6 0 0 1 19 15.2H9.5L5.5 19v-3.8H5A1.6 1.6 0 0 1 3.4 13.6V6.6A1.6 1.6 0 0 1 5 5z" /><path d="M12 8v3.2" /><circle cx="12" cy="13.5" r="0.6" fill="currentColor" stroke="none" /></>,
  book: <><path d="M12 6.2c-2-1.3-4.6-1.6-7.2-1.1v11.4c2.6-.5 5.2-.2 7.2 1.1 2-1.3 4.6-1.6 7.2-1.1V5.1c-2.6-.5-5.2-.2-7.2 1.1z" /><path d="M12 6.2v11.4" /></>,
  cap: <><path d="M12 4.2 21.5 8.4 12 12.6 2.5 8.4z" /><path d="M6.6 10.6v3.9c0 1.4 2.7 2.9 5.4 2.9s5.4-1.5 5.4-2.9v-3.9" /><path d="M21.5 8.4v4.4" /></>,
  clean: <><path d="M11 3.4l1.7 4.6 4.6 1.7-4.6 1.7L11 16l-1.7-4.6L4.7 9.7l4.6-1.7z" /><path d="M18 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" /></>,
  star: <path d="M12 3.6l2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.4l-5.05 2.65.95-5.6L3.85 9.5l5.6-.8z" />,
  // 衛生與整潔子入口
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8 20.5 20.5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9.5h16M8 3v4M16 3v4" /></>,
  drop: <><path d="M12 3.4c3.6 4.1 6 6.9 6 10.1a6 6 0 0 1-12 0c0-3.2 2.4-6 6-10.1z" /><path d="M9.4 13.2a2.6 2.6 0 0 0 2.6 2.6" /></>,
}

export default function Icon({ name, size = 26, color = 'currentColor', width = 2.2 }) {
  const p = PATHS[name]
  if (!p) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  )
}
