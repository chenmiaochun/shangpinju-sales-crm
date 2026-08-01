import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Activity, CheckCircle2, Database, Download, FileCheck2, Link2, RotateCcw, ShieldCheck, Upload, XCircle } from 'lucide-react'
import type { AfterSalesTicket, Customer, DeliveryTask, FollowUp, SalesOrder, SupplyDemand } from '../../types'
import { createBackup, validateBackup, type SalesBackup } from './backup'
import './data-admin.css'

export type ConnectionStatus = 'unconfigured' | 'pending' | 'connected'
export interface AuditEvent { id: string; action: string; at: string; actor?: string; detail?: string }
export interface IntegrationSettings { corpId: string; agentId: string; secretConfigured?: boolean }
export interface DataAdminPageProps {
  customers: Customer[]
  followUps: FollowUp[]
  orders?: SalesOrder[]
  deliveryTasks?: DeliveryTask[]
  afterSalesTickets?: AfterSalesTicket[]
  supplyDemands?: SupplyDemand[]
  auditEvents: AuditEvent[]
  connectionStatus: ConnectionStatus
  onExportBackup?: () => unknown | Promise<unknown>
  onRestoreBackup: (backup: SalesBackup) => void | Promise<void>
  integrationSettings: IntegrationSettings
  onSaveIntegration: (settings: { corpId: string; agentId: string; secret?: string }) => void | Promise<void>
}

const statusCopy = {
  unconfigured: { label: '未配置', note: '填写接入信息后保存，连接仍需单独验证。' },
  pending: { label: '待验证', note: '配置已保存，尚未确认企业微信连接可用。' },
  connected: { label: '已连接', note: '当前连接状态由系统验证结果提供。' },
}

export function DataAdminPage(props: DataAdminPageProps) {
  const { customers, followUps, auditEvents, connectionStatus, integrationSettings } = props
  const [preview, setPreview] = useState<SalesBackup | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [corpId, setCorpId] = useState(integrationSettings.corpId)
  const [agentId, setAgentId] = useState(integrationSettings.agentId)
  const [secret, setSecret] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const missingPhones = customers.filter((item) => !item.phone.trim()).length
  const orphanFollowUps = followUps.filter((item) => !customers.some((customer) => customer.id === item.customerId)).length

  async function exportBackup() {
    const supplied = await props.onExportBackup?.()
    const payload = supplied ?? createBackup(customers, followUps, new Date(), { orders: props.orders ?? [], deliveryTasks: props.deliveryTasks ?? [], afterSalesTickets: props.afterSalesTickets ?? [], supplyDemands: props.supplyDemands ?? [] })
    const blob = new Blob([typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `sales-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
    URL.revokeObjectURL(url)
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setPreview(null); setConfirming(false); setErrors([])
    if (!file) return
    try {
      const result = validateBackup(JSON.parse(await file.text()))
      if (result.valid) setPreview(result.data)
      else setErrors(result.errors)
    } catch { setErrors(['文件不是有效的 JSON']) }
    event.target.value = ''
  }

  async function restore() {
    if (!preview) return
    await props.onRestoreBackup(preview)
    setPreview(null); setConfirming(false)
  }

  async function saveIntegration(event: FormEvent) {
    event.preventDefault()
    await props.onSaveIntegration({ corpId: corpId.trim(), agentId: agentId.trim(), ...(secret ? { secret } : {}) })
    setSecret('')
  }

  return <section className="data-admin" aria-label="数据管理与接入中心">
    <header className="data-admin-header"><div><p>系统管理</p><h1>数据管理与接入中心</h1><span>备份、恢复与外部接入均在本机完成操作确认</span></div><div className={`connection-badge status-${connectionStatus}`}><Activity size={18} /><div><b>{statusCopy[connectionStatus].label}</b><small>企业微信</small></div></div></header>

    <div className="health-grid">
      <article><Database /><span>客户记录</span><strong>{customers.length}</strong><small>当前数据总量</small></article>
      <article><FileCheck2 /><span>跟进记录</span><strong>{followUps.length}</strong><small>可随备份恢复</small></article>
      <article className={missingPhones ? 'health-warning' : ''}><ShieldCheck /><span>缺失手机号</span><strong>{missingPhones}</strong><small>{missingPhones ? '建议补齐关键资料' : '关键资料完整'}</small></article>
      <article className={orphanFollowUps ? 'health-warning' : ''}><Link2 /><span>孤立跟进</span><strong>{orphanFollowUps}</strong><small>{orphanFollowUps ? '未匹配客户记录' : '关联关系正常'}</small></article>
    </div>

    <div className="admin-columns">
      <div className="admin-stack">
        <section className="admin-panel"><header><div><h2>本地数据备份</h2><p>下载 JSON 文件，文件不会上传到服务器。</p></div><button className="primary-action" onClick={exportBackup}><Download size={17} />下载备份</button></header>
          <div className="restore-zone"><Upload size={24} /><div><b>从 JSON 备份恢复</b><span>选择文件后先解析、校验并预览，不会立即覆盖数据。</span></div><button onClick={() => fileRef.current?.click()}>选择文件</button><input ref={fileRef} type="file" accept="application/json,.json" onChange={readFile} hidden aria-label="选择备份文件" /></div>
          {errors.length > 0 && <div className="validation-box invalid" role="alert"><XCircle /><div><b>备份校验失败</b><ul>{errors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}</ul>{errors.length > 6 && <small>另有 {errors.length - 6} 项错误</small>}</div></div>}
          {preview && <div className="validation-box valid"><CheckCircle2 /><div><b>文件校验通过</b><p>{preview.customers.length} 位客户 · {preview.followUps.length} 条跟进 · 导出于 {formatDate(preview.exportedAt)}</p>{!confirming ? <button className="danger-action" onClick={() => setConfirming(true)}><RotateCcw size={16} />准备恢复</button> : <div className="confirm-row"><strong>恢复会替换当前数据，确认继续？</strong><button className="danger-action" onClick={restore}>确认恢复</button><button onClick={() => setConfirming(false)}>取消</button></div>}</div></div>}
        </section>

        <section className="admin-panel audit-panel"><header><div><h2>最近操作审计</h2><p>展示由应用传入的真实操作记录。</p></div></header>{auditEvents.length ? <ol>{auditEvents.slice(0, 8).map((event) => <li key={event.id}><span></span><div><b>{event.action}</b><p>{event.detail || '无补充说明'}</p></div><time>{formatDate(event.at)}{event.actor ? ` · ${event.actor}` : ''}</time></li>)}</ol> : <div className="admin-empty">暂无审计记录</div>}</section>
      </div>

      <section className="admin-panel integration-panel"><header><div><h2>企业微信接入</h2><p>仅保存配置，不将“已保存”等同于“已连接”。</p></div></header><div className={`status-callout status-${connectionStatus}`}><Activity /><div><b>{statusCopy[connectionStatus].label}</b><p>{statusCopy[connectionStatus].note}</p></div></div>
        <form onSubmit={saveIntegration}><label>Corp ID<input aria-label="Corp ID" value={corpId} onChange={(event) => setCorpId(event.target.value)} required autoComplete="off" /></label><label>Agent ID<input aria-label="Agent ID" value={agentId} onChange={(event) => setAgentId(event.target.value)} required autoComplete="off" /></label><label>Secret<input aria-label="Secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={integrationSettings.secretConfigured ? '已配置，留空则不修改' : '请输入 Secret'} autoComplete="new-password" /><small>Secret 不会在页面回显明文。</small></label><button className="primary-action" type="submit">保存接入配置</button></form>
      </section>
    </div>
  </section>
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
