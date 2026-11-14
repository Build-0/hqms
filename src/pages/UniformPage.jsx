import { itemLevel } from '../lib/accounts'
import Uniform from './boh/Uniform'

// 制服與布草管理：獨立模組（開發中，預設只限開發者）
export default function UniformPage({ session, init }) {
  return (
    <div className="df-wrap">
      <Uniform init={init} edit={itemLevel(session, 'uniform') === 'edit'} who={session ? session.name : ''} />
    </div>
  )
}
