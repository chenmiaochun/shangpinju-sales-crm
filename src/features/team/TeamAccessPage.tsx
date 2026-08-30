import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, CircleCheck, KeyRound, LoaderCircle, Pencil, RotateCw, Save, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react'
import { salesApi, type CreateAccountInput, type RemoteAccount, type UpdateAccountInput } from '../../api/salesApi'
import { PERMISSION_LABELS, REQUIRED_EMPLOYEE_PERMISSIONS, ROLE_LABELS, getIdentityPermissions, getIdentityRoles, getRolesPermissions, hasIdentityRole, type AccessPermission, type TeamRole } from './access'
import type { TeamMember } from './members'
import './team.css'

const TEAM_ROLES: TeamRole[] = ['manager', 'sales', 'designer', 'operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier']
const PERMISSION_GROUPS: { label: string; permissions: AccessPermission[] }[] = [
  { label: '客户与销售', permissions: ['customers.own', 'customers.design', 'tasks.own', 'designer.dispatch', 'conversation.analysis', 'sop'] },
  { label: '商品进销存', permissions: ['inventory.manage', 'replenishment.request', 'replenishment.approve', 'purchasing.manage', 'inventory.receive', 'inventory.issue', 'inventory.transfer', 'inventory.audit'] },
  { label: '财务与资金', permissions: ['revenue.summary', 'cost.view', 'finance.reconcile', 'cashier.payments'] },
  { label: '经营与系统', permissions: ['store.analytics', 'coaching', 'data.manage', 'members.manage'] },
]

export interface TeamAccessPageProps {
  members?: TeamMember[]
  initialMembers?: TeamMember[]
  storageKey?: string
  onMembersChange?: (members: TeamMember[]) => void
  onActiveMemberChange?: (member: TeamMember) => void
}

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  : '-'

function AccountRoleSummary({ account }: { account: RemoteAccount }) {
  const auxiliary = getIdentityRoles(account).filter((role) => role !== account.role)
  return <span className="account-role"><b>主：{ROLE_LABELS[account.role]}</b>{auxiliary.length ? <small>辅：{auxiliary.map((role) => ROLE_LABELS[role]).join('、')}</small> : null}</span>
}

function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : ''
  if (text.includes('409')) return '登录账号已存在，请更换后重试。'
  if (text.includes('403')) return '当前账号没有管理成员的权限。'
  if (text.includes('400')) return '账号信息不符合要求，或该账号不能执行此操作。'
  return '操作未完成，请检查网络后重试。'
}

export function TeamAccessPage(_props: TeamAccessPageProps) {
  const [accounts, setAccounts] = useState<RemoteAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialog, setDialog] = useState<'add' | 'edit' | 'reset' | 'delete' | null>(null)
  const [selected, setSelected] = useState<RemoteAccount | null>(null)
  const [busyId, setBusyId] = useState('')
  const [roleFilter, setRoleFilter] = useState<TeamRole | null>(null)
  const [permissionAccountId, setPermissionAccountId] = useState('')

  const load = async (retry = false) => {
    retry ? setRetrying(true) : setLoading(true)
    setError('')
    try { const next = (await salesApi.getAccounts()).accounts; setAccounts(next); setPermissionAccountId((current) => current || next.find((item) => item.role !== 'manager')?.id || next[0]?.id || '') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false); setRetrying(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { if (!success) return; const timer = window.setTimeout(() => setSuccess(''), 3200); return () => window.clearTimeout(timer) }, [success])

  const roleCounts = useMemo(() => Object.fromEntries(TEAM_ROLES.map((role) => [role, accounts.filter((item) => hasIdentityRole(item, role)).length])) as Record<TeamRole, number>, [accounts])
  const visibleAccounts = roleFilter ? accounts.filter((item) => hasIdentityRole(item, roleFilter)) : accounts

  const openDialog = (next: typeof dialog, account: RemoteAccount | null = null) => { setSelected(account); setDialog(next) }
  const closeDialog = () => { setSelected(null); setDialog(null) }
  const showSuccess = (message: string) => { setSuccess(message); setError('') }

  const toggleActive = async (account: RemoteAccount) => {
    setBusyId(account.id); setError('')
    try {
      const { account: updated } = await salesApi.setAccountActive(account.id, !account.active)
      setAccounts((items) => items.map((item) => item.id === updated.id ? updated : item)); window.dispatchEvent(new Event('sales-crm:accounts-changed'))
      showSuccess(`${account.name} 的账号已${updated.active ? '启用' : '禁用'}`)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusyId('') }
  }

  return <main className="team-access" aria-labelledby="team-title">
    <header className="team-header"><div><p>团队与安全</p><h1 id="team-title">成员账号管理</h1><span>创建员工账号，分配岗位权限，管控登录状态。</span></div><button type="button" onClick={() => openDialog('add')}><UserPlus size={17}/>新增账号</button></header>
    {salesApi.isStaticDemo ? <aside className="team-security-note offline"><AlertTriangle size={19}/><div><strong>当前是外网离线测试模式</strong><span>本页新增账号、修改权限或重置密码只保存在当前浏览器，不会同步到员工设备。跨设备内置测试账号为 spj001 至 spj005，统一临时密码 <code>{salesApi.staticTestPassword}</code>。</span></div></aside> : <aside className="team-security-note secure"><ShieldCheck size={19}/><div><strong>账号由服务端安全管理</strong><span>初始密码仅用于首次登录，员工登录后须修改密码；停用账号会阻止其继续访问系统。</span></div></aside>}
    {error && <div className="team-feedback warning" role="alert"><AlertTriangle size={17}/><span>{error}</span><button type="button" disabled={retrying} onClick={() => void load(true)}>{retrying ? <><LoaderCircle className="spin" size={15}/>重试中</> : <><RotateCw size={15}/>重试</>}</button></div>}
    {success && <div className="team-feedback success" role="status"><CircleCheck size={17}/><span>{success}</span></div>}
    <div className="team-layout">
      <section className="team-panel account-panel"><header><div><h2>登录账号</h2><p>{accounts.filter((item) => item.active).length} 个启用账号</p></div><div className="role-counts" aria-label="按角色筛选">{TEAM_ROLES.map((role) => <button type="button" aria-pressed={roleFilter === role} className={roleFilter === role ? 'selected' : ''} key={role} onClick={() => setRoleFilter((current) => current === role ? null : role)}>{ROLE_LABELS[role]} <b>{roleCounts[role]}</b></button>)}</div></header>
        {loading ? <div className="team-empty"><LoaderCircle className="spin"/><strong>正在读取账号...</strong></div> : visibleAccounts.length === 0 ? <div className="team-empty"><span className="empty-icon"><Users/></span><strong>暂无员工账号</strong><p>点击右上角「新增账号」即可创建员工账号并分配权限</p><button type="button" className="empty-create" onClick={() => openDialog('add')}><UserPlus size={15}/>立即创建</button></div> : <div className="member-table" role="table">
          <div className="member-row account-row member-head" role="row"><span>员工姓名</span><span>登录账号</span><span>所属角色</span><span>账号状态</span><span>创建时间</span><span>操作</span></div>
          {visibleAccounts.map((account) => <div className="member-row account-row" role="row" key={account.id}><div className="member-name"><b>{account.name.slice(0, 1)}</b><strong>{account.name}</strong></div><span className="account-username">{account.username}</span><AccountRoleSummary account={account}/><span className={account.active ? 'status-active' : 'status-off'}>{account.active ? '启用' : '禁用'}</span><small className="created-at">{formatDate(account.createdAt)}</small><div className="account-actions"><button type="button" title="编辑" aria-label={`编辑 ${account.name}`} onClick={() => openDialog('edit', account)}><Pencil size={14}/></button><button type="button" title="重置密码" aria-label={`重置 ${account.name} 的密码`} onClick={() => openDialog('reset', account)}><KeyRound size={14}/></button><button className="status-button" type="button" disabled={busyId === account.id} onClick={() => void toggleActive(account)}>{busyId === account.id ? '处理中' : account.active ? '禁用' : '启用'}</button><button type="button" className="delete-button" title="删除" aria-label={`删除 ${account.name}`} onClick={() => openDialog('delete', account)}><Trash2 size={14}/></button></div></div>)}
        </div>}
      </section>
      <PermissionEditor accounts={accounts} selectedId={permissionAccountId} onSelect={setPermissionAccountId} onSaved={(account) => { setAccounts((items) => items.map((item) => item.id === account.id ? account : item)); showSuccess(`${account.name} 的权限已更新，对方刷新页面后生效`) }} onError={setError}/>
    </div>
    {dialog === 'add' && <AccountDialog mode="add" onClose={closeDialog} onSave={(account) => { setAccounts((items) => [...items, account]); closeDialog(); showSuccess(`员工账号「${account.name}」新增成功${salesApi.isStaticDemo ? '，仅当前浏览器有效' : ''}`) }} onError={setError}/>}
    {dialog === 'edit' && selected && <AccountDialog mode="edit" account={selected} onClose={closeDialog} onSave={(account) => { setAccounts((items) => items.map((item) => item.id === account.id ? account : item)); closeDialog(); showSuccess(`员工账号「${account.name}」已更新`) }} onError={setError}/>}
    {dialog === 'reset' && selected && <ResetPasswordDialog account={selected} onClose={closeDialog} onDone={() => showSuccess(`${selected.name} 的初始密码已重置${salesApi.isStaticDemo ? '，仅当前浏览器有效' : ''}`)} onError={setError}/>}
    {dialog === 'delete' && selected && <DeleteAccountDialog account={selected} onClose={closeDialog} onDeleted={() => { setAccounts((items) => items.filter((item) => item.id !== selected.id)); window.dispatchEvent(new Event('sales-crm:accounts-changed')); closeDialog(); showSuccess(`员工账号「${selected.name}」已删除`) }} onError={setError}/>}
  </main>
}

function PermissionEditor({ accounts, selectedId, onSelect, onSaved, onError }: { accounts: RemoteAccount[]; selectedId: string; onSelect: (id: string) => void; onSaved: (account: RemoteAccount) => void; onError: (message: string) => void }) {
  const account = accounts.find((item) => item.id === selectedId) ?? null
  const [permissions, setPermissions] = useState<AccessPermission[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => { setPermissions(account ? getIdentityPermissions(account) : []) }, [account?.id, account?.role, account?.canDesign, account?.permissions?.join('|')])
  const locked = account ? hasIdentityRole(account, 'manager') : false
  const toggle = (permission: AccessPermission) => {
    if (locked || REQUIRED_EMPLOYEE_PERMISSIONS.includes(permission)) return
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission])
  }
  const save = async () => {
    if (!account || locked) return
    setSaving(true); onError('')
    try {
      const result = await salesApi.updateAccount(account.id, { username: account.username, name: account.name, role: account.role, roles: getIdentityRoles(account), canDesign: account.canDesign, phone: account.phone, permissions })
      onSaved(result.account)
    } catch (cause) { onError(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return <section className="team-panel matrix-panel"><header><div><h2>员工权限设置</h2><p>岗位提供默认权限，也可按员工调整实际职责</p></div></header><div className="permission-person"><label>选择员工<select value={selectedId} onChange={(event) => onSelect(event.target.value)}><option value="">请选择员工</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {getIdentityRoles(item).map((role) => ROLE_LABELS[role]).join(' + ')}</option>)}</select></label>{account && <span>{locked ? '店长固定拥有全部权限' : `${permissions.length} 项权限`}</span>}</div><div className="permission-checks">{PERMISSION_GROUPS.map((group) => <section className="permission-group" key={group.label}><h3>{group.label}</h3>{group.permissions.map((permission) => { const required = REQUIRED_EMPLOYEE_PERMISSIONS.includes(permission); const checked = locked || permissions.includes(permission); return <label className={checked ? 'checked' : ''} key={permission}><input type="checkbox" checked={checked} disabled={locked || required} onChange={() => toggle(permission)}/><span>{PERMISSION_LABELS[permission]}{required && !locked ? <small>基础权限</small> : null}</span></label> })}</section>)}</div><div className="permission-save"><p>员工可以兼任多个岗位；采购、审批、收付款和库存操作分别授权，避免职责重复。</p><button type="button" disabled={!account || locked || saving} onClick={() => void save()}><Save size={15}/>{saving ? '保存中' : '保存权限'}</button></div></section>
}

function AccountDialog({ mode, account, onClose, onSave, onError }: { mode: 'add' | 'edit'; account?: RemoteAccount; onClose: () => void; onSave: (account: RemoteAccount) => void; onError: (message: string) => void }) {
  const initialRoles = account ? getIdentityRoles(account) : ['sales' as TeamRole]
  const [form, setForm] = useState<CreateAccountInput>({ username: account?.username ?? '', name: account?.name ?? '', role: account?.role ?? initialRoles[0], roles: initialRoles, password: '', phone: account?.phone ?? '' })
  const [submitting, setSubmitting] = useState(false)
  const auxiliaryRoles = (form.roles ?? [form.role]).filter((role) => role !== form.role && role !== 'manager')
  const changePrimaryRole = (role: TeamRole) => setForm((current) => ({ ...current, role, roles: [role, ...(current.roles ?? []).filter((item) => item !== role && item !== 'manager')] }))
  const toggleAuxiliaryRole = (role: TeamRole) => setForm((current) => { const auxiliaries = (current.roles ?? []).filter((item) => item !== current.role && item !== 'manager'); const next = auxiliaries.includes(role) ? auxiliaries.filter((item) => item !== role) : [...auxiliaries, role]; return { ...current, roles: [current.role, ...next] } })
  const submit = async (event: FormEvent) => { event.preventDefault(); setSubmitting(true); onError(''); try { const roles = [form.role, ...auxiliaryRoles]; const rolePermissions = form.role === 'manager' ? undefined : getRolesPermissions(roles); const extraPermissions = (account?.permissions ?? []).filter((permission) => !(rolePermissions ?? []).includes(permission)); const permissions = rolePermissions ? [...new Set([...rolePermissions, ...extraPermissions])] : undefined; const input = { username: form.username.trim(), name: form.name.trim(), role: form.role, roles, canDesign: roles.includes('designer'), permissions, phone: form.phone?.trim() }; const result = mode === 'add' ? await salesApi.createAccount({ ...input, password: form.password }) : await salesApi.updateAccount(account!.id, input as UpdateAccountInput); window.dispatchEvent(new Event('sales-crm:accounts-changed')); onSave(result.account) } catch (cause) { onError(errorMessage(cause)) } finally { setSubmitting(false) } }
  return <Dialog title={mode === 'add' ? '新增员工账号' : '编辑员工账号'} onClose={onClose}><form onSubmit={submit}><label>员工姓名 <b>*</b><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入员工姓名"/></label><label>登录账号 <b>*</b><input required minLength={3} pattern="[A-Za-z0-9._-]+" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="如：liuming"/></label>{mode === 'add' && <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })}/>}<label>主岗位 <b>*</b><select required value={form.role} onChange={(event) => changePrimaryRole(event.target.value as TeamRole)}>{TEAM_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><small>决定默认工作台、客户归属和主要职责</small></label><fieldset className="role-options auxiliary-role-options"><legend>辅助岗位</legend>{TEAM_ROLES.filter((role) => role !== 'manager' && role !== form.role).map((role) => <label key={role} className={auxiliaryRoles.includes(role) ? 'checked' : ''}><input type="checkbox" checked={auxiliaryRoles.includes(role)} onChange={() => toggleAuxiliaryRole(role)}/><span>{ROLE_LABELS[role]}</span></label>)}<small>可多选，用于接收设计、售后等协作任务；权限与主岗位合并。</small></fieldset><label>联系手机号（选填）<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="请输入手机号"/></label><footer><button type="button" className="secondary" onClick={onClose}>取消</button><button type="submit" disabled={submitting}>{submitting ? '正在保存...' : mode === 'add' ? '确认新增' : '保存修改'}</button></footer></form></Dialog>
}

function ResetPasswordDialog({ account, onClose, onDone, onError }: { account: RemoteAccount; onClose: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSubmitting(true); onError(''); try { await salesApi.resetAccountPassword(account.id, password); onClose(); onDone() } catch (cause) { onError(errorMessage(cause)) } finally { setSubmitting(false) } }
  return <Dialog title={`重置 ${account.name} 的密码`} onClose={onClose}><form onSubmit={submit}><p className="dialog-hint">重置后，该员工下次登录必须修改此初始密码。</p><PasswordField value={password} onChange={setPassword}/><footer><button type="button" className="secondary" onClick={onClose}>取消</button><button type="submit" disabled={submitting}>{submitting ? '正在重置...' : '确认重置'}</button></footer></form></Dialog>
}

function DeleteAccountDialog({ account, onClose, onDeleted, onError }: { account: RemoteAccount; onClose: () => void; onDeleted: () => void; onError: (message: string) => void }) {
  const [submitting, setSubmitting] = useState(false)
  const remove = async () => { setSubmitting(true); onError(''); try { await salesApi.deleteAccount(account.id); onDeleted() } catch (cause) { onError(errorMessage(cause)) } finally { setSubmitting(false) } }
  return <Dialog title="删除员工账号" onClose={onClose}><div className="delete-confirm"><AlertTriangle/><p>确认删除员工账号「{account.name}」？删除后无法恢复，该员工也将无法继续登录。</p><footer><button type="button" className="secondary" onClick={onClose}>取消</button><button type="button" className="danger" disabled={submitting} onClick={() => void remove()}>{submitting ? '正在删除...' : '确认删除'}</button></footer></div></Dialog>
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label>初始密码 <b>*</b><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="请输入 6 位数字"/><small>员工首次登录后须修改密码</small></label> }
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="team-dialog-backdrop" role="presentation"><section className="team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title"><header><div><p>账号管理</p><h2 id="team-dialog-title">{title}</h2></div><button type="button" aria-label="关闭" onClick={onClose}><X/></button></header>{children}</section></div> }

export default TeamAccessPage
