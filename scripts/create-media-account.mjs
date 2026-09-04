// 创建「图文采集」(media) 角色账号 —— 用于产品图采集台。
// 用法：node scripts/create-media-account.mjs <用户名> <密码> <姓名>
// 例：  node scripts/create-media-account.mjs kaida 123456 凯达
// 说明：该角色只有 media.upload 权限（只能上传产品图），
//       看不到订单 / 客户 / 财务等任何敏感数据，可多人共用同一端口。
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SalesDatabase } from '../server/database.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dbPath = join(here, '..', 'server', 'data', 'sales.sqlite')

const [username, password, name] = process.argv.slice(2)
if (!username || !password || !name) {
  console.error('用法: node scripts/create-media-account.mjs <用户名> <密码> <姓名>')
  process.exit(1)
}

const db = new SalesDatabase(dbPath)
try {
  const account = db.createAccount({
    username,
    password,
    name,
    role: 'media',
    roles: ['media'],
    mustChangePassword: false,
    active: true,
  })
  console.log(`✅ 已创建图文采集账号  id=${account.id}  username=${username}  name=${name}`)
  console.log('   登录后默认进入「产品图采集台」(/media-upload)。')
} catch (err) {
  console.error('❌ 创建失败:', err.message)
  process.exit(1)
}
