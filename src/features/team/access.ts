export type TeamRole = 'manager' | 'sales' | 'designer' | 'operations' | 'aftersales'

export type AccessPermission =
  | 'store.analytics'
  | 'coaching'
  | 'data.manage'
  | 'members.manage'
  | 'customers.own'
  | 'customers.design'
  | 'tasks.own'
  | 'conversation.analysis'
  | 'sop'
  | 'revenue.summary'

export type CustomerAccessSubject = {
  salesperson?: string
  salespersonId?: string
  designer?: string
  designerId?: string
  designerIds?: string[]
  sourceService?: string
  pendingSalesperson?: string
  pendingSalespersonId?: string
}

export interface RoleIdentity {
  id: string
  name: string
  role: TeamRole
  roles?: TeamRole[]
  canDesign?: boolean
  permissions?: AccessPermission[]
}

export const ROLE_LABELS: Record<TeamRole, string> = {
  manager: '店长',
  sales: '销售',
  designer: '设计师',
  operations: '运营',
  aftersales: '售后',
}

export const PERMISSION_LABELS: Record<AccessPermission, string> = {
  'store.analytics': '全库经营分析',
  coaching: '销售辅导',
  'data.manage': '数据管理',
  'members.manage': '成员管理',
  'customers.own': '本人客户',
  'customers.design': '方案相关客户',
  'tasks.own': '本人任务',
  'conversation.analysis': '沟通分析',
  sop: '销售 SOP',
  'revenue.summary': '经营金额汇总',
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as AccessPermission[]

const ROLE_PERMISSIONS: Record<TeamRole, ReadonlySet<AccessPermission>> = {
  manager: new Set(ALL_PERMISSIONS),
  sales: new Set(['customers.own', 'tasks.own', 'conversation.analysis', 'sop']),
  designer: new Set(['customers.own', 'customers.design', 'tasks.own', 'conversation.analysis']),
  operations: new Set(['customers.own', 'tasks.own', 'conversation.analysis', 'sop']),
  aftersales: new Set(['customers.own', 'tasks.own', 'conversation.analysis', 'sop']),
}

export function getIdentityRoles(identity: Pick<RoleIdentity, 'role' | 'roles' | 'canDesign'>): TeamRole[] {
  const roles = identity.roles?.length ? identity.roles : [identity.role]
  const compatible = identity.canDesign && !roles.includes('designer') ? [...roles, 'designer' as const] : roles
  return [...new Set(compatible)]
}

export function hasIdentityRole(identity: Pick<RoleIdentity, 'role' | 'roles' | 'canDesign'>, role: TeamRole): boolean {
  return getIdentityRoles(identity).includes(role)
}

export const REQUIRED_EMPLOYEE_PERMISSIONS: AccessPermission[] = ['customers.own', 'tasks.own']

export function hasPermission(role: TeamRole, permission: AccessPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}

export function getRolePermissions(role: TeamRole): AccessPermission[] {
  return ALL_PERMISSIONS.filter((permission) => hasPermission(role, permission))
}

export function getRolesPermissions(roles: TeamRole[]): AccessPermission[] {
  return ALL_PERMISSIONS.filter((permission) => roles.some((role) => hasPermission(role, permission)))
}

export function hasIdentityPermission(identity: RoleIdentity, permission: AccessPermission): boolean {
  const roles = getIdentityRoles(identity)
  if (roles.includes('manager')) return true
  if (REQUIRED_EMPLOYEE_PERMISSIONS.includes(permission)) return true
  if (identity.permissions) return identity.permissions.includes(permission)
  return roles.some((role) => hasPermission(role, permission))
}

export function getIdentityPermissions(identity: RoleIdentity): AccessPermission[] {
  return ALL_PERMISSIONS.filter((permission) => hasIdentityPermission(identity, permission))
}

export function getDefaultRoute(identity: RoleIdentity): string {
  if (hasIdentityPermission(identity, 'store.analytics')) return '/dashboard'
  if (hasIdentityPermission(identity, 'customers.own') || hasIdentityPermission(identity, 'customers.design')) return '/customers'
  if (hasIdentityPermission(identity, 'tasks.own')) return '/tasks'
  return '/more'
}

export function canAccessCustomer(identity: RoleIdentity, customer: CustomerAccessSubject): boolean {
  const roles = getIdentityRoles(identity)
  if (roles.includes('manager')) return true
  if (roles.includes('operations') || roles.includes('aftersales')) {
    return customer.salespersonId === identity.id || customer.salesperson === identity.name
      || customer.pendingSalespersonId === identity.id || customer.pendingSalesperson === identity.name
      || customer.sourceService === identity.name
  }
  if (roles.includes('sales')) {
    return customer.salespersonId === identity.id || customer.salesperson === identity.name || customer.pendingSalespersonId === identity.id || customer.pendingSalesperson === identity.name
      || Boolean(roles.includes('designer') && (customer.designerId === identity.id || customer.designer === identity.name || customer.designerIds?.includes(identity.id)))
  }
  return customer.designerId === identity.id
    || customer.designer === identity.name
    || customer.designerIds?.includes(identity.id) === true
}

export function canViewRevenueSummary(role: TeamRole): boolean {
  return hasPermission(role, 'revenue.summary')
}
