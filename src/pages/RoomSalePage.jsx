import { itemLevel } from '../lib/accounts'
import RoomSale from './boh/RoomSale'

// 房間可售物品價錢／庫存表：獨立模組
export default function RoomSalePage({ session }) {
  return (
    <div className="df-wrap">
      <RoomSale edit={itemLevel(session, 'roomsale') === 'edit'} />
    </div>
  )
}
