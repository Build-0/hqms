import { itemLevel } from '../lib/accounts'
import WriteOff from './boh/WriteOff'

// 報銷與遺失管理：獨立模組（開發中，預設只限開發者）
export default function WriteOffPage({ session }) {
  return (
    <div className="df-wrap">
      <WriteOff edit={itemLevel(session, 'writeoff') === 'edit'} who={session ? session.name : ''} />
    </div>
  )
}
