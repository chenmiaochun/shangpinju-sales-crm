import type { AccessPermission, TeamRole } from './access'

export interface TeamMember {
  id: string
  name: string
  role: TeamRole
  roles?: TeamRole[]
  canDesign?: boolean
  permissions?: AccessPermission[]
  phone?: string
  active: boolean
}

export const defaultTeamMembers: TeamMember[] = [
  { id: 'member-manager', name: '陈店长', role: 'manager', phone: '138 0000 1001', active: true },
  { id: 'member-sales-1', name: '刘先生', role: 'sales', phone: '138 0000 1002', active: true },
  { id: 'member-sales-2', name: '王顾问', role: 'sales', phone: '138 0000 1003', active: true },
  { id: 'member-designer', name: '林设计师', role: 'designer', phone: '138 0000 1004', active: true },
  { id: 'member-operations', name: '赵运营', role: 'operations', phone: '138 0000 1005', active: true },
  { id: 'member-aftersales', name: '孙售后', role: 'aftersales', phone: '138 0000 1006', active: true },
  { id: 'member-purchasing', name: '采购专员', role: 'purchasing', phone: '', active: true },
  { id: 'member-warehouse', name: '仓库管理员', role: 'warehouse', phone: '', active: true },
  { id: 'member-finance', name: '财务人员', role: 'finance', phone: '', active: true },
  { id: 'member-cashier', name: '出纳人员', role: 'cashier', phone: '', active: true },
]
