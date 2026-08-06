import { describe, expect, it } from 'vitest'
import { canAccessCustomer, canViewRevenueSummary, getDefaultRoute, getIdentityPermissions, getRolePermissions, hasIdentityPermission, hasPermission } from './access'

describe('team role access', () => {
  it('gives managers full store and member-management access', () => {
    expect(hasPermission('manager', 'store.analytics')).toBe(true)
    expect(hasPermission('manager', 'coaching')).toBe(true)
    expect(hasPermission('manager', 'data.manage')).toBe(true)
    expect(hasPermission('manager', 'members.manage')).toBe(true)
    expect(canViewRevenueSummary('manager')).toBe(true)
  })

  it('limits salespeople to their personal workflow', () => {
    expect(getRolePermissions('sales')).toEqual(['customers.own', 'tasks.own', 'conversation.analysis', 'sop', 'replenishment.request'])
    expect(canAccessCustomer({ id: 's1', name: '小刘', role: 'sales' }, { salespersonId: 's1' })).toBe(true)
    expect(canAccessCustomer({ id: 's1', name: '小刘', role: 'sales' }, { salesperson: '小王' })).toBe(false)
    expect(canAccessCustomer({ id: 's1', name: '小刘', role: 'sales' }, { pendingSalespersonId: 's1' })).toBe(true)
    expect(canViewRevenueSummary('sales')).toBe(false)
  })

  it('lets designers see assigned customers but no revenue summary', () => {
    const designer = { id: 'd1', name: '林设计师', role: 'designer' as const }
    expect(canAccessCustomer(designer, { designerIds: ['d1'] })).toBe(true)
    expect(canAccessCustomer(designer, { designer: '其他设计师' })).toBe(false)
    expect(hasPermission('designer', 'customers.design')).toBe(true)
    expect(hasPermission('designer', 'customers.own')).toBe(true)
    expect(canViewRevenueSummary('designer')).toBe(false)
  })

  it('limits operations to customer intake and follow-up workflows', () => {
    expect(hasPermission('operations', 'store.analytics')).toBe(false)
    expect(hasPermission('operations', 'members.manage')).toBe(false)
    expect(hasPermission('operations', 'data.manage')).toBe(false)
    expect(hasPermission('operations', 'sop')).toBe(true)
    expect(canViewRevenueSummary('operations')).toBe(false)
    expect(getDefaultRoute({ id: 'ops-1', name: '赵运营', role: 'operations' })).toBe('/customers')
    expect(hasPermission('aftersales', 'tasks.own')).toBe(true)
    expect(canAccessCustomer({ id: 'ops-1', name: '赵运营', role: 'operations' }, { sourceService: '赵运营' })).toBe(true)
    expect(canAccessCustomer({ id: 'ops-1', name: '赵运营', role: 'operations' }, { sourceService: '其他运营' })).toBe(false)
    expect(canAccessCustomer({ id: 'service-1', name: '孙售后', role: 'aftersales' }, { salespersonId: 'service-1' })).toBe(true)
  })

  it('combines sales and designer access without inheriting manager access', () => {
    const dualRole = { id: 'sd-1', name: '销售设计师', role: 'sales' as const, canDesign: true }
    expect(hasIdentityPermission(dualRole, 'customers.own')).toBe(true)
    expect(hasIdentityPermission(dualRole, 'customers.design')).toBe(true)
    expect(hasIdentityPermission(dualRole, 'store.analytics')).toBe(false)
    expect(hasIdentityPermission(dualRole, 'members.manage')).toBe(false)
    expect(canAccessCustomer(dualRole, { salespersonId: 'someone-else', designerId: 'sd-1' })).toBe(true)
    expect(getDefaultRoute(dualRole)).toBe('/customers')
  })

  it('keeps every employee role out of manager-only capabilities', () => {
    const managerOnly = ['coaching', 'data.manage', 'members.manage'] as const
    const employeeRoles = ['sales', 'designer', 'operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier'] as const
    for (const role of employeeRoles) {
      for (const permission of managerOnly) expect(hasPermission(role, permission)).toBe(false)
    }
  })

  it('applies per-account permissions while preserving required workflow access', () => {
    const custom = { id: 'ops-2', name: '江惠柔', role: 'operations' as const, permissions: ['conversation.analysis' as const] }
    expect(hasIdentityPermission(custom, 'conversation.analysis')).toBe(true)
    expect(hasIdentityPermission(custom, 'store.analytics')).toBe(false)
    expect(hasIdentityPermission(custom, 'customers.own')).toBe(false)
    expect(hasIdentityPermission(custom, 'tasks.own')).toBe(true)
    expect(getIdentityPermissions(custom)).toEqual(['tasks.own', 'conversation.analysis'])
  })

  it('separates purchasing, warehouse, finance and cashier responsibilities', () => {
    expect(hasPermission('purchasing', 'purchasing.manage')).toBe(true)
    expect(hasPermission('purchasing', 'inventory.receive')).toBe(false)
    expect(hasPermission('warehouse', 'inventory.receive')).toBe(true)
    expect(hasPermission('warehouse', 'finance.reconcile')).toBe(false)
    expect(hasPermission('finance', 'finance.reconcile')).toBe(true)
    expect(hasPermission('finance', 'cashier.payments')).toBe(false)
    expect(hasPermission('cashier', 'cashier.payments')).toBe(true)
    expect(hasPermission('cashier', 'cost.view')).toBe(false)
    expect(getDefaultRoute({ id:'w1', name:'仓管', role:'warehouse' })).toBe('/inventory')
  })
})
