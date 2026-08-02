import { useMemo, useState, type ReactNode } from 'react'
import { BarChart3, Bell, Bot, ChartNoAxesCombined, CheckCheck, ChevronDown, ChevronRight, ClipboardList, ContactRound, Database, GraduationCap, LayoutGrid, ListChecks, LogOut, MessageSquareText, PackageCheck, Search, Settings, UserCog, UserPlus, X } from 'lucide-react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AIQualityPage } from './features/ai'
import { CustomersPage } from './features/customers'
import { ManagerDashboard } from './features/dashboard'
import { ConversationAnalyzerPage } from './features/conversation'
import { CoachingCenterPage } from './features/coaching'
import { SalesInsightsPage } from './features/insights'
import { LeadsPage } from './features/leads'
import { LifecyclePage } from './features/lifecycle'
import { TaskCenterPage } from './features/tasks'
import { SalesSopPage } from './features/sop'
import { DataAdminPage, type ConnectionStatus } from './features/data-admin'
import { RoleProvider, ROLE_LABELS, TeamAccessPage, canAccessCustomer, getDefaultRoute, getIdentityRoles, hasIdentityRole, useRoleAccess, type AccessPermission, type TeamMember } from './features/team'
import { SalesDataProvider, useSalesData } from './store/SalesDataContext'
import { LoginPage } from './auth/LoginPage'
import { useAuth } from './auth/AuthContext'

const navigation = [
  { to: '/dashboard', label: '经营分析', icon: BarChart3, permission: 'store.analytics' },
  { to: '/customers', label: '客户跟进', icon: ContactRound, permission: 'customers.own' },
  { to: '/lifecycle', label: '成交履约', icon: PackageCheck, permission: 'customers.own' },
  { to: '/tasks', label: '任务中心', icon: ClipboardList, permission: 'tasks.own' },
  { to: '/leads', label: '线索数据', icon: UserPlus, permission: 'customers.own' },
  { to: '/quality', label: 'AI 质检', icon: Bot, permission: 'store.analytics' },
  { to: '/conversation', label: '沟通分析', icon: MessageSquareText, permission: 'conversation.analysis' },
  { to: '/sop', label: '销售 SOP', icon: ListChecks, permission: 'sop' },
  { to: '/coaching', label: '辅导中心', icon: GraduationCap, permission: 'coaching' },
  { to: '/insights', label: '深度洞察', icon: ChartNoAxesCombined, permission: 'store.analytics' },
  { to: '/team', label: '团队权限', icon: UserCog, permission: 'members.manage' },
  { to: '/data-admin', label: '数据管理', icon: Database, permission: 'data.manage' },
]

type NavItem = typeof navigation[number]
const canUseItem = (can: (permission: AccessPermission) => boolean, item: NavItem) => item.to === '/customers' ? can('customers.own') || can('customers.design') : can(item.permission as AccessPermission)

function MorePage({ items }: { items: NavItem[] }) {
  return <main className="more-page"><header><p>尚品居销售工作台</p><h1>全部功能</h1></header><div className="module-grid">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={23} /><span>{label}</span></NavLink>)}</div></main>
}

function Allowed({ permission, children }: { permission: AccessPermission; children: ReactNode }) {
  const access = useRoleAccess()
  return access.can(permission) ? children : <Navigate to={getDefaultRoute(access.identity)} replace />
}

function CustomerAllowed({ children }: { children: ReactNode }) {
  const access = useRoleAccess()
  return access.can('customers.own') || access.can('customers.design') ? children : <Navigate to={getDefaultRoute(access.identity)} replace />
}

function AppShell({ activeMember }: { activeMember: TeamMember }) {
  const sales = useSalesData()
  const auth = useAuth()
  const access = useRoleAccess()
  const [topbarPanel, setTopbarPanel] = useState<'notifications' | 'settings' | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)
  const visibleNavigation = navigation.filter((item) => canUseItem(access.can, item))
  const visibleCustomers = useMemo(() => {
    const aftersales = hasIdentityRole(activeMember, 'aftersales')
    const assignedDeliveryCustomerIds = new Set(sales.deliveryTasks.filter((task) => task.ownerId === activeMember.id || task.owner === activeMember.name || (aftersales && task.owner === '待指派')).map((task) => task.customerId))
    return sales.customers.filter((customer) => canAccessCustomer(activeMember, customer) || (aftersales && assignedDeliveryCustomerIds.has(customer.id)))
  }, [activeMember, sales.customers, sales.deliveryTasks])
  const visibleIds = useMemo(() => new Set(visibleCustomers.map((item) => item.id)), [visibleCustomers])
  const visibleFollowUps = sales.followUps.filter((item) => visibleIds.has(item.customerId))
  const notifications = useMemo(() => {
    const now = new Date()
    const overdue = visibleCustomers.filter((customer) => customer.nextFollowUpAt && new Date(customer.nextFollowUpAt) < now && customer.stage !== '已成交' && customer.stage !== '已流失').length
    const today = visibleCustomers.filter((customer) => customer.nextFollowUpAt && new Date(customer.nextFollowUpAt).toDateString() === now.toDateString() && customer.stage !== '已成交' && customer.stage !== '已流失').length
    const design = sales.designTasks.filter((task) => task.status === '待接收' && (hasIdentityRole(activeMember, 'manager') || task.designerId === activeMember.id || task.designerName === activeMember.name)).length
    const delivery = sales.deliveryTasks.filter((task) => task.status !== '已完成' && (hasIdentityRole(activeMember, 'manager') || task.ownerId === activeMember.id || task.owner === activeMember.name || (task.owner === '待指派' && Boolean(task.remindAt && new Date(task.remindAt) <= now) && visibleIds.has(task.customerId)))).length
    return [
      overdue ? { id: 'overdue', title: `${overdue} 位客户跟进已逾期`, detail: '请尽快联系并更新下一步计划', to: '/customers' } : null,
      today ? { id: 'today', title: `今日还有 ${today} 项跟进`, detail: '完成后及时登记沟通结果', to: '/tasks' } : null,
      design ? { id: 'design', title: `${design} 项设计任务待接收`, detail: '查看需求与计划完成时间', to: '/tasks' } : null,
      delivery ? { id: 'delivery', title: `${delivery} 项交付任务待处理`, detail: '查看排期、送货安装和验收进度', to: '/lifecycle' } : null,
    ].filter((item): item is { id: string; title: string; detail: string; to: string } => Boolean(item))
  }, [activeMember.id, activeMember.name, activeMember.role, sales.deliveryTasks, sales.designTasks, visibleCustomers, visibleIds])
  const mergeVisibleState = (next: { customers: typeof sales.customers; followUps: typeof sales.followUps }) => {
    const updates = new Map(next.customers.map((item) => [item.id, item]))
    sales.replaceState({ customers: sales.customers.map((item) => updates.get(item.id) ?? item), followUps: [...next.followUps, ...sales.followUps.filter((item) => !visibleIds.has(item.customerId))], designTasks: sales.designTasks, orders: sales.orders, deliveryTasks: sales.deliveryTasks, afterSalesTickets: sales.afterSalesTickets, supplyDemands: sales.supplyDemands })
  }
  const wechat = sales.integrationSettings.wechat ?? {}
  const connectionStatus: ConnectionStatus = wechat.status === 'connected' ? 'connected' : wechat.corpId && wechat.agentId ? 'pending' : 'unconfigured'
  const mobileItems = [navigation[0], navigation[1], navigation[2], navigation[5]].filter((item) => visibleNavigation.includes(item))
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand"><span className="brand-mark">尚</span><div><strong>尚品居</strong><small>销售工作台</small></div></div>
        <nav aria-label="主导航">
          {visibleNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note"><span>今日进度</span><strong>3 / 5</strong><div><i /></div><small>还有 2 位客户待跟进</small></div>
        <div className="account-area">
          {accountMenuOpen && <div className="account-menu" id="account-menu" role="menu" aria-label="账号菜单">
            <div className="account-menu-status"><strong>{activeMember.name}</strong><small>{getIdentityRoles(activeMember).map((role) => ROLE_LABELS[role]).join(' + ')}</small><span className={sales.serverStatus === 'connected' ? 'is-connected' : ''}>{sales.serverStatus === 'connected' ? '数据已同步' : '当前为离线模式'}</span></div>
            <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setTopbarPanel('settings') }}><Settings size={16}/><span>系统设置</span></button>
            {access.can('members.manage') && <NavLink role="menuitem" to="/team" onClick={() => setAccountMenuOpen(false)}><UserCog size={16}/><span>成员与权限</span></NavLink>}
            {access.can('data.manage') && <NavLink role="menuitem" to="/data-admin" onClick={() => setAccountMenuOpen(false)}><Database size={16}/><span>数据管理</span></NavLink>}
            <button type="button" role="menuitem" className="account-logout" onClick={() => void auth.logout()}><LogOut size={16}/><span>退出登录</span></button>
          </div>}
          <button type="button" className="account" aria-label="打开账号菜单" aria-expanded={accountMenuOpen} aria-controls="account-menu" onClick={() => setAccountMenuOpen((open) => !open)}><span>{activeMember.name.slice(0, 1)}</span><div><strong>{activeMember.name}</strong><small>{getIdentityRoles(activeMember).map((role) => ROLE_LABELS[role]).join(' + ')} · {sales.serverStatus === 'connected' ? '已同步' : '离线模式'}</small></div><ChevronDown className={accountMenuOpen ? 'is-open' : ''} size={15} /></button>
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div className="topbar-search"><Search size={17} /><span>搜索客户、手机号或产品</span></div>
          <div className="topbar-actions">
            <button type="button" title="消息提醒" aria-label="消息提醒" aria-expanded={topbarPanel === 'notifications'} onClick={() => setTopbarPanel((current) => current === 'notifications' ? null : 'notifications')}><Bell size={19} />{!notificationsRead && notifications.length > 0 && <i>{notifications.length}</i>}</button>
            <button type="button" title="系统设置" aria-label="系统设置" aria-expanded={topbarPanel === 'settings'} onClick={() => setTopbarPanel((current) => current === 'settings' ? null : 'settings')}><Settings size={19} /></button>
          </div>
          {topbarPanel === 'notifications' && <TopbarPanel title="消息提醒" onClose={() => setTopbarPanel(null)} footer={notifications.length > 0 && !notificationsRead ? <button className="panel-text-action" onClick={() => setNotificationsRead(true)}><CheckCheck size={15}/>全部标记已读</button> : undefined}>
            {notifications.length ? <div className="notification-list">{notifications.map((item) => <NavLink key={item.id} to={item.to} onClick={() => setTopbarPanel(null)}><span className={!notificationsRead ? 'unread-dot' : ''}/><div><strong>{item.title}</strong><small>{item.detail}</small></div><ChevronRight size={15}/></NavLink>)}</div> : <div className="topbar-empty"><CheckCheck size={23}/><strong>暂无新提醒</strong><span>当前跟进安排正常</span></div>}
          </TopbarPanel>}
          {topbarPanel === 'settings' && <TopbarPanel title="系统设置" onClose={() => setTopbarPanel(null)}>
            <div className="settings-summary"><span>{activeMember.name.slice(0, 1)}</span><div><strong>{activeMember.name}</strong><small>{ROLE_LABELS[activeMember.role]} · {sales.serverStatus === 'connected' ? '数据已同步' : '当前为离线模式'}</small></div></div>
            <nav className="settings-links" aria-label="系统设置快捷入口">
              {access.can('members.manage') && <NavLink to="/team" onClick={() => setTopbarPanel(null)}><UserCog size={17}/><span><strong>成员与权限</strong><small>管理员工账号及岗位权限</small></span><ChevronRight size={15}/></NavLink>}
              {access.can('data.manage') && <NavLink to="/data-admin" onClick={() => setTopbarPanel(null)}><Database size={17}/><span><strong>数据管理</strong><small>备份、恢复及系统接入</small></span><ChevronRight size={15}/></NavLink>}
              {!access.can('members.manage') && !access.can('data.manage') && <div className="topbar-empty"><Settings size={22}/><strong>暂无可配置项目</strong><span>如需调整权限，请联系店长</span></div>}
            </nav>
          </TopbarPanel>}
        </header>
        <div className="app-content">
          <Routes>
            <Route path="/dashboard" element={<Allowed permission="store.analytics"><ManagerDashboard customers={sales.customers} followUps={sales.followUps} /></Allowed>} />
            <Route path="/customers" element={<CustomerAllowed><CustomersPage customers={visibleCustomers} followUps={visibleFollowUps} designers={sales.designers} salespeople={sales.salespeople} deliveryStaff={sales.deliveryStaff} activeMember={activeMember} onStateChange={mergeVisibleState} onRegisterDeal={sales.registerDeal} onAddDesignTask={(task) => { sales.addDesignTask(task); sales.updateCustomer(task.customerId, { designerId: task.designerId, designer: task.designerName }) }} /></CustomerAllowed>} />
            <Route path="/lifecycle" element={<CustomerAllowed><LifecyclePage customers={visibleCustomers} orders={sales.orders.filter((item) => visibleIds.has(item.customerId))} deliveryTasks={sales.deliveryTasks.filter((item) => visibleIds.has(item.customerId))} afterSalesTickets={sales.afterSalesTickets.filter((item) => visibleIds.has(item.customerId))} activeUser={activeMember.name} onAddOrder={sales.addOrder} onUpdateOrder={sales.updateOrder} onAddPayment={sales.addPayment} onAddDelivery={sales.addDeliveryTask} onUpdateDelivery={sales.updateDeliveryTask} onAddTicket={sales.addAfterSalesTicket} onUpdateTicket={sales.updateAfterSalesTicket} /></CustomerAllowed>} />
            <Route path="/tasks" element={<Allowed permission="tasks.own"><TaskCenterPage customers={visibleCustomers} followUps={visibleFollowUps} designTasks={sales.designTasks} activeMember={activeMember} onCompleteTask={sales.addFollowUp} onUpdateDesignTask={sales.updateDesignTask} /></Allowed>} />
            <Route path="/leads" element={<Allowed permission="customers.own"><LeadsPage customers={visibleCustomers} onAddCustomers={(customers) => sales.addCustomers(customers.map((customer) => activeMember.role === 'operations' ? { ...customer, sourceService: activeMember.name } : customer))} /></Allowed>} />
            <Route path="/quality" element={<Allowed permission="store.analytics"><AIQualityPage customers={sales.customers} followUps={sales.followUps} /></Allowed>} />
            <Route path="/conversation" element={<Allowed permission="conversation.analysis"><ConversationAnalyzerPage customers={visibleCustomers} onApplyAnalysis={(id, patch, followUp) => { sales.updateCustomer(id, patch); sales.addFollowUp(followUp) }} /></Allowed>} />
            <Route path="/sop" element={<Allowed permission="sop"><SalesSopPage customers={visibleCustomers} followUps={visibleFollowUps} /></Allowed>} />
            <Route path="/coaching" element={<Allowed permission="coaching"><CoachingCenterPage customers={sales.customers} followUps={sales.followUps} /></Allowed>} />
            <Route path="/insights" element={<Allowed permission="store.analytics"><SalesInsightsPage customers={sales.customers} followUps={sales.followUps} /></Allowed>} />
            <Route path="/team" element={<Allowed permission="members.manage"><TeamAccessPage /></Allowed>} />
            <Route path="/data-admin" element={<Allowed permission="data.manage"><DataAdminPage customers={sales.customers} followUps={sales.followUps} orders={sales.orders} deliveryTasks={sales.deliveryTasks} afterSalesTickets={sales.afterSalesTickets} supplyDemands={sales.supplyDemands} auditEvents={sales.auditEvents.map((item) => ({ id: String(item.id), action: `${item.action} ${item.resource}`, at: item.createdAt, detail: JSON.stringify(item.details) }))} connectionStatus={connectionStatus} onRestoreBackup={(backup) => sales.replaceState({ customers: backup.customers, followUps: backup.followUps, designTasks: sales.designTasks, orders: backup.orders ?? [], deliveryTasks: backup.deliveryTasks ?? [], afterSalesTickets: backup.afterSalesTickets ?? [], supplyDemands: backup.supplyDemands ?? [] })} integrationSettings={{ corpId: String(wechat.corpId ?? ''), agentId: String(wechat.agentId ?? ''), secretConfigured: Boolean(wechat.secretConfigured || wechat.secret) }} onSaveIntegration={async (settings) => sales.saveIntegrations({ ...sales.integrationSettings, wechat: { ...wechat, corpId: settings.corpId, agentId: settings.agentId, ...(settings.secret ? { secret: settings.secret } : {}), secretConfigured: Boolean(settings.secret || wechat.secretConfigured || wechat.secret), status: 'pending' } })} /></Allowed>} />
            <Route path="/more" element={<MorePage items={visibleNavigation} />} />
            <Route path="*" element={<Navigate to={getDefaultRoute(activeMember)} replace />} />
          </Routes>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="移动端导航">
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : ''}>
            <Icon size={20} /><span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/more" className={({ isActive }) => isActive ? 'is-active' : ''}><LayoutGrid size={20} /><span>全部</span></NavLink>
      </nav>
    </div>
  )
}

function TopbarPanel({ title, onClose, footer, children }: { title: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  return <section className="topbar-panel" aria-label={title}><header><strong>{title}</strong><button type="button" onClick={onClose} aria-label={`关闭${title}`}><X size={16}/></button></header><div className="topbar-panel-body">{children}</div>{footer && <footer>{footer}</footer>}</section>
}

export function App() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <main className="auth-loading">正在验证登录状态...</main>
  if (auth.status === 'anonymous') return <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" state={{ from: location.pathname }} replace />} /></Routes>
  const activeMember = auth.user!
  return <SalesDataProvider><RoleProvider identity={activeMember}><Routes><Route path="/login" element={<Navigate to={getDefaultRoute(activeMember)} replace />} /><Route path="*" element={<AppShell activeMember={activeMember} />} /></Routes></RoleProvider></SalesDataProvider>
}
