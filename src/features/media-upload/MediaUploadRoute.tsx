import { useRoleAccess, ROLE_LABELS } from '../team'
import MediaUploadPage from './MediaUploadPage'

export default function MediaUploadRoute() {
  const access = useRoleAccess()
  if (access.can('media.upload')) return <MediaUploadPage />
  const roleLabel = access.identity ? ROLE_LABELS[access.identity.role] : '当前账号'
  return (
    <main className="media-upload">
      <div className="mu-noperm">
        <h1>无访问权限</h1>
        <p>
          「产品图采集台」需要 <strong>图文采集</strong> 账号（media 角色）登录才能使用。
        </p>
        <p>
          你当前使用的是「{roleLabel}」账号，没有图片上传权限，因此无法进入。
        </p>
        <p className="mu-noperm-hint">
          请用凯达等图文采集账号登录；店长账号可在左侧「图文采集」直接进入查看。
        </p>
      </div>
    </main>
  )
}
