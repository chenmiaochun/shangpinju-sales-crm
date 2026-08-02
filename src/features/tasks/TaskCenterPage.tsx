import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock3, FileUp, ListTodo, UserRound, X } from 'lucide-react'
import type { Customer, CustomerFile, DesignTask, FollowUp } from '../../types'
import type { TeamMember } from '../team'
import { buildNextAction, NextActionPicker } from '../followups/NextActionPicker'
import { deriveFollowUpTasks, groupTasksBySchedule, type FollowUpTask, type TaskCategory, type TaskPriority } from './task-utils'
import './tasks.css'

export interface TaskCenterPageProps {
  customers: Customer[]
  followUps: FollowUp[]
  onCompleteTask: (followUp: FollowUp) => void
  now?: Date
  designTasks?: DesignTask[]
  activeMember?: TeamMember
  onUpdateDesignTask?: (id: string, changes: Partial<DesignTask>) => void
}

const categories: { id: TaskCategory; label: string }[] = [
  { id: 'today', label: '今日' }, { id: 'overdue', label: '逾期' },
  { id: 'future', label: '未来' }, { id: 'unscheduled', label: '无计划' },
]

const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 })
const dateTime = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function groupTitle(key: string, now: Date) {
  if (key === 'unscheduled') return '待制定计划'
  const value = new Date(`${key}T12:00:00`)
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return key === today ? '今天' : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(value)
}

export function TaskCenterPage({ customers, followUps, onCompleteTask, now = new Date(), designTasks = [], activeMember, onUpdateDesignTask }: TaskCenterPageProps) {
  const [focusedCustomerId, setFocusedCustomerId] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] ?? '').get('customer') ?? '')
  const [category, setCategory] = useState<TaskCategory>('today')
  const [owner, setOwner] = useState('全部')
  const [priority, setPriority] = useState<TaskPriority | '全部'>('全部')
  const [activeTask, setActiveTask] = useState<FollowUpTask | null>(null)
  const [mode, setMode] = useState<'sales' | 'design'>('sales')
  const tasks = useMemo(() => deriveFollowUpTasks(customers, followUps, now), [customers, followUps, now])
  const requestedTask = tasks.find((task) => task.customer.id === focusedCustomerId)
  useEffect(() => { if (requestedTask) { setMode('sales'); setCategory(requestedTask.category) } }, [requestedTask?.category])
  const owners = useMemo(() => [...new Set(customers.map((item) => item.salesperson))], [customers])
  const counts = useMemo(() => Object.fromEntries(categories.map(({ id }) => [id, tasks.filter((task) => task.category === id).length])) as Record<TaskCategory, number>, [tasks])
  const visible = tasks.filter((task) => task.category === category && (!focusedCustomerId || task.customer.id === focusedCustomerId) && (owner === '全部' || task.customer.salesperson === owner) && (priority === '全部' || task.priority === priority))
  const groups = groupTasksBySchedule(visible)
  const visibleDesignTasks = designTasks.filter((task) => !activeMember || activeMember.role === 'manager' || task.designerId === activeMember.id || task.designerName === activeMember.name || task.salesperson === activeMember.name)

  return <section className="task-center" aria-label="跟进任务中心">
    <header className="task-header">
      <div><p>销售执行</p><h1>跟进任务中心</h1><span>{tasks.length} 位客户需要持续推进</span></div>
      <div className="task-header-stat"><ListTodo size={20} /><strong>{counts.today + counts.overdue}</strong><span>今日待处理</span></div>
    </header>

    <nav className="task-tabs" aria-label="任务分类">
      <button className={mode === 'design' ? 'design-tab active' : 'design-tab'} onClick={() => setMode('design')}><span>设计协作</span><b>{visibleDesignTasks.filter((task) => task.status !== '已完成').length}</b></button>
      {categories.map((item) => <button key={item.id} className={mode === 'sales' && category === item.id ? 'active' : ''} onClick={() => { setMode('sales'); setCategory(item.id) }}><span>{item.label}</span><b>{counts[item.id]}</b></button>)}
    </nav>

    {mode === 'sales' && <div className="task-toolbar">
      <div><label>销售人员<select aria-label="销售人员" value={owner} onChange={(event) => setOwner(event.target.value)}><option>全部</option>{owners.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>优先级<select aria-label="优先级" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | '全部')}><option>全部</option><option value="高">高优先</option><option value="中">中优先</option><option value="低">低优先</option></select></label></div>
      <span>共 {visible.length} 项</span>
    </div>}
    {mode === 'sales' && focusedCustomerId && <div className="task-customer-focus"><span>{requestedTask ? `已定位客户：${requestedTask.customer.name} · ${requestedTask.nextAction}` : '该客户当前没有可执行任务'}</span><button type="button" onClick={() => setFocusedCustomerId('')}>查看全部任务</button></div>}

    <main className="task-schedule">
      {mode === 'design' ? <DesignTaskList tasks={visibleDesignTasks} canReview={activeMember?.role === 'manager' || activeMember?.role === 'sales'} onUpdate={onUpdateDesignTask} /> : <>
      {groups.map((group) => <section className="schedule-group" key={group.key}>
        <header><CalendarDays size={17} /><h2>{groupTitle(group.key, now)}</h2><span>{group.tasks.length} 项</span></header>
        <div className="task-list">{group.tasks.map((task) => <TaskRow key={task.customer.id} task={task} onComplete={() => setActiveTask(task)} />)}</div>
      </section>)}
      {!groups.length && <div className="task-empty"><Check size={28} /><strong>当前没有任务</strong><span>调整筛选条件查看其他安排</span></div>}
      </>}
    </main>
    {activeTask && <CompleteDialog task={activeTask} now={now} onClose={() => setActiveTask(null)} onSubmit={(record) => { onCompleteTask(record); setActiveTask(null) }} />}
  </section>
}

function DesignTaskList({ tasks, canReview, onUpdate }: { tasks: DesignTask[]; canReview: boolean; onUpdate?: (id: string, changes: Partial<DesignTask>) => void }) {
  if (!tasks.length) return <div className="task-empty"><Check size={28} /><strong>暂无设计协作任务</strong><span>销售在跟进记录中开启“需要设计师协助”后，任务会显示在这里</span></div>
  return <div className="design-task-list">{tasks.map((task) => <article className="design-task-card" key={task.id}><header><div><h2>{task.customerName}<span>{task.type}</span>{task.priority === '紧急' && <i>紧急</i>}</h2><p>@{task.designerName} · 销售负责人 {task.salesperson}</p></div><strong className={`design-status status-${task.status}`}>{task.status}</strong></header><p className="design-requirement">{task.requirement}</p><div className="design-meta">计划完成：{new Date(task.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 参考资料 {task.referenceFiles.length} 个</div>{task.solutionFiles.length > 0 && <div className="design-meta">已提交方案：{task.solutionFiles.map((file) => file.name).join('、')}</div>}<div className="design-actions">{task.status === '待接收' && <button onClick={() => onUpdate?.(task.id, { status: '设计中' })}>开始设计</button>}{task.status === '待销售确认' && canReview && <><button onClick={() => onUpdate?.(task.id, { status: '客户沟通中' })}>确认并发送客户</button><button className="outline" onClick={() => onUpdate?.(task.id, { status: '修改中' })}>退回修改</button></>}{task.status === '客户沟通中' && canReview && <><button onClick={() => onUpdate?.(task.id, { status: '已完成' })}>客户已确认</button><button className="outline" onClick={() => onUpdate?.(task.id, { status: '修改中' })}>客户要求修改</button></>}{task.status === '设计中' || task.status === '修改中' ? <SolutionUploader task={task} onSubmit={(files, note) => onUpdate?.(task.id, { solutionFiles: files, solutionNote: note, status: '待销售确认' })} /> : null}</div></article>)}</div>
}

function SolutionUploader({ task, onSubmit }: { task: DesignTask; onSubmit: (files: CustomerFile[], note: string) => void }) {
  const [files, setFiles] = useState(task.solutionFiles)
  const [note, setNote] = useState(task.solutionNote ?? '')
  return <div className="solution-uploader"><input className="visually-hidden" id={`solution-${task.id}`} type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.cad,.zip" onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? []).map((file) => ({ id: `solution-${Date.now()}-${file.name}`, name: file.name, type: file.type || '文件', size: file.size }))])} /><label htmlFor={`solution-${task.id}`}><FileUp size={15} />上传方案</label><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="方案说明"/><button onClick={() => onSubmit(files, note)}>提交销售确认</button>{files.length > 0 && <small>{files.map((file) => file.name).join('、')}</small>}</div>
}

function TaskRow({ task, onComplete }: { task: FollowUpTask; onComplete: () => void }) {
  const { customer } = task
  return <article className={`task-row priority-${task.priority}`}>
    <div className="task-time">{task.scheduledAt ? <><Clock3 size={15} /><strong>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(task.scheduledAt))}</strong></> : <><UserRound size={15} /><strong>待安排</strong></>}</div>
    <div className="task-main"><div className="task-title"><h3>{customer.name}</h3><span>{customer.stage}</span><i>{task.priority}优先</i></div><p>{task.nextAction}</p><div className="task-meta"><span>负责人 {customer.salesperson}</span><span>预计成交 {money.format(customer.expectedAmount)}</span>{task.scheduledAt && <span>{dateTime.format(new Date(task.scheduledAt))}</span>}</div></div>
    {task.overdueDays > 0 && <div className="overdue-mark"><AlertTriangle size={15} />超期 {task.overdueDays} 天</div>}
    <button className="complete-button" onClick={onComplete}><Check size={17} />完成跟进</button>
  </article>
}

function CompleteDialog({ task, now, onClose, onSubmit }: { task: FollowUpTask; now: Date; onClose: () => void; onSubmit: (record: FollowUp) => void }) {
  const [channel, setChannel] = useState<FollowUp['channel']>('微信')
  const [content, setContent] = useState('')
  const [result, setResult] = useState('')
  const [nextActions, setNextActions] = useState<string[]>([])
  const [customAction, setCustomAction] = useState('')
  const [nextAt, setNextAt] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const nextAction = buildNextAction(nextActions, customAction)
    onSubmit({ id: `task-followup-${now.getTime()}-${task.customer.id}`, customerId: task.customer.id, salesperson: task.customer.salesperson, at: now.toISOString(), channel, content: content.trim(), result: result.trim(), nextAction: nextAction || undefined, nextAt: nextAt ? new Date(nextAt).toISOString() : undefined })
  }
  return <div className="task-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-task-title"><header><div><p>记录沟通结果</p><h2 id="complete-task-title">完成跟进 · {task.customer.name}</h2></div><button type="button" aria-label="关闭" onClick={onClose}><X size={20} /></button></header>
      <form onSubmit={submit}><fieldset><legend>沟通渠道</legend><div className="channel-picker">{(['微信', '电话', '到店', '量尺'] as FollowUp['channel'][]).map((item) => <label key={item}><input type="radio" name="channel" checked={channel === item} onChange={() => setChannel(item)} /><span>{item}</span></label>)}</div></fieldset>
        <label>沟通内容<textarea required rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录客户反馈与关键需求" /></label>
        <label>跟进结果<input required value={result} onChange={(event) => setResult(event.target.value)} placeholder="本次沟通取得了什么结果" /></label>
        <div className="next-fields"><NextActionPicker selected={nextActions} customAction={customAction} onSelectedChange={setNextActions} onCustomActionChange={setCustomAction} /><label>下次时间<input type="datetime-local" min={localInput(now)} value={nextAt} onChange={(event) => setNextAt(event.target.value)} /></label></div>
        <footer><button type="button" className="cancel-button" onClick={onClose}>取消</button><button type="submit" className="save-button"><Check size={17} />确认完成</button></footer>
      </form>
    </section>
  </div>
}

export default TaskCenterPage
