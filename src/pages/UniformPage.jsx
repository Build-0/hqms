import { itemLevel } from '../lib/accounts'
import Uniform from './boh/Uniform'

// 制服庫存管理：獨立模組（開發中，預設只限開發者）
export default function UniformPage({ session }) {
  return (
    <div className="df-wrap">
      <Uniform edit={itemLevel(session, 'uniform') === 'edit'} who={session ? session.name : ''} />
    </div>
  )
}
