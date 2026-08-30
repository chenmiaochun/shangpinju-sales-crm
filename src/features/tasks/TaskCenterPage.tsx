import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock3, FileUp, ListTodo, UserRound, X } from 'lucide-react'
import type { Customer, CustomerFile, DesignTask, FollowUp } from '../../types'
import type { TeamMember } from '../team'
import { hasIdentityRole, hasIdentityPermission } from '../team'
import { buildNextAction, NextActionPicker } from '../followups/NextActionPicker'
import { deriveFollowUpTasks, groupTasksBySchedule, type FollowUpTask, type TaskCategory, type TaskPriority } from './task-utils'
import './tasks.css'
import './design-review.css'

export interface TaskCenterPageProps {
  customers: Customer[]
  followUps: FollowUp[]
  onCompleteTask: (followUp: FollowUp) => void
  now?: Date
  designTasks?: DesignTask[]
  activeMember?: TeamMember
  onUpdateDesignTask?: (id: string, changes: Partial<DesignTask>) => void
  designers?: { id: string; name: string }[]
}

const categories: { id: TaskCategory; label: string }[] = [
  { id: 'today', label: '今日' }, { id: 'overdue', label: '逾期' },
  { id: 'future', label: '未来' }, { id: 'unscheduled', label: '无计划' },
]

type TaskView = TaskCategory | 'due'

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

export function TaskCenterPage({ customers, followUps, onCompleteTask, now = new Date(), designTasks = [], activeMember, onUpdateDesignTask, designers = [] }: TaskCenterPageProps) {
  const [focusedCustomerId, setFocusedCustomerId] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] ?? '').get('customer') ?? '')
  const [category, setCategory] = useState<TaskView>('today')
  const [owner, setOwner] = useState('全部')
  const [priority, setPriority] = useState<TaskPriority | '全部'>('全部')
  const [activeTask, setActiveTask] = useState<FollowUpTask | null>(null)
  const [mode, setMode] = useState<'sales' | 'design'>(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] ?? '').get('mode') === 'design' ? 'design' : 'sales')
  const tasks = useMemo(() => deriveFollowUpTasks(customers, followUps, now), [customers, followUps, now])
  const requestedTask = tasks.find((task) => task.customer.id === focusedCustomerId)
  useEffect(() => { if (requestedTask) { setMode('sales'); setCategory(requestedTask.category) } }, [requestedTask?.category])
  const owners = useMemo(() => [...new Set(customers.map((item) => item.salesperson))], [customers])
  const counts = useMemo(() => Object.fromEntries(categories.map(({ id }) => [id, tasks.filter((task) => task.category === id).length])) as Record<TaskCategory, number>, [tasks])
  const visible = tasks.filter((task) => (category === 'due' ? task.category === 'today' || task.category === 'overdue' : task.category === category) && (!focusedCustomerId || task.customer.id === focusedCustomerId) && (owner === '全部' || task.customer.salesperson === owner) && (priority === '全部' || task.priority === priority))
  const groups = groupTasksBySchedule(visible)
  const visibleDesignTasks = designTasks.filter((task) => !activeMember || hasIdentityRole(activeMember, 'manager') || hasIdentityPermission(activeMember, 'designer.dispatch') || task.designerId === activeMember.id || task.designerName === activeMember.name || task.salesperson === activeMember.name)

  return <section className="task-center" aria-label="跟进任务中心">
    <header className="task-header">
      <div><p>销售执行</p><h1>跟进任务中心</h1><span>{tasks.length} 位客户需要持续推进</span></div>
      <button type="button" className={`task-header-stat${mode === 'sales' && category === 'due' ? ' active' : ''}`} aria-pressed={mode === 'sales' && category === 'due'} onClick={() => { setMode('sales'); setCategory('due'); setFocusedCustomerId('') }}><ListTodo size={20} /><strong>{counts.today + counts.overdue}</strong><span>今日待处理</span></button>
    </header>

    <nav className="task-tabs" aria-label="任务分类">
      <button className={mode === 'design' ? 'design-tab active' : 'design-tab'} onClick={() => setMode('design')}><span>设计协作</span><b>{visibleDesignTasks.filter((task) => task.status !== '已完成').length}</b></button>
      {categories.map((item) => <button key={item.id} className={mode === 'sales' && category === item.id ? 'active' : ''} onClick={() => { setMode('sales'); setCategory(item.id); setFocusedCustomerId('') }}><span>{item.label}</span><b>{counts[item.id]}</b></button>)}
    </nav>

    {mode === 'sales' && <div className="task-toolbar">
      <div><label>销售人员<select aria-label="销售人员" value={owner} onChange={(event) => setOwner(event.target.value)}><option>全部</option>{owners.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>优先级<select aria-label="优先级" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | '全部')}><option>全部</option><option value="高">高优先</option><option value="中">中优先</option><option value="低">低优先</option></select></label></div>
      <span>共 {visible.length} 项</span>
    </div>}
    {mode === 'sales' && focusedCustomerId && <div className="task-customer-focus"><span>{requestedTask ? `已定位客户：${requestedTask.customer.name} · ${requestedTask.nextAction}` : '该客户当前没有可执行任务'}</span><button type="button" onClick={() => setFocusedCustomerId('')}>查看全部任务</button></div>}

    <main className="task-schedule">
      {mode === 'design' ? <DesignTaskList tasks={visibleDesignTasks} worker={activeMember} reviewer={activeMember?.name ?? ''} canReview={Boolean(activeMember && (hasIdentityRole(activeMember, 'manager') || hasIdentityRole(activeMember, 'sales')))} canAssign={Boolean(activeMember && (hasIdentityRole(activeMember, 'manager') || hasIdentityPermission(activeMember, 'designer.dispatch')))} designers={designers} onUpdate={onUpdateDesignTask} /> : <>
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

function DesignTaskList({ tasks, worker, canReview, reviewer, onUpdate, designers, canAssign }: { tasks: DesignTask[]; worker?: TeamMember; canReview: boolean; reviewer: string; onUpdate?: (id: string, changes: Partial<DesignTask>) => void; designers: { id: string; name: string }[]; canAssign: boolean }) {
  const [rejectingId, setRejectingId] = useState('')
  const [feedback, setFeedback] = useState('')
  if (!tasks.length) return <div className="task-empty"><Check size={28} /><strong>暂无设计协作任务</strong><span>销售在跟进记录中开启“需要设计师协助”后，任务会显示在这里</span></div>
  return <div className="design-task-list">{canAssign && designers.length > 0 && <div className="design-load-board">{designers.map((d) => { const load = tasks.filter((t) => t.designerId === d.id && (t.status === '待接收' || t.status === '设计中' || t.status === '修改中')).length; return <span key={d.id} className="design-load-chip">{d.name} · 在手 {load} 项</span> })}</div>}{tasks.map((task) => { const canWork = Boolean(worker && (task.designerId === worker.id || task.designerName === worker.name)); return <article className="design-task-card" key={task.id}><header><div><h2>{task.customerName}<span>{task.type}</span>{task.priority !== '普通' && <i className={`pri-${task.priority}`}>{task.priority}</i>}</h2><p>{task.status === '待分配' ? '待派工分配设计师' : `@${task.designerName}`} · 销售负责人 {task.salesperson}</p></div><strong className={`design-status status-${task.status}`}>{task.status}</strong></header><p className="design-requirement">{task.requirement}</p><div className="design-meta">计划完成：{new Date(task.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 参考资料 {task.referenceFiles.length} 个</div>{task.referenceFiles.length > 0 && <div className="design-file-links">参考资料：{task.referenceFiles.map((file) => file.url || file.dataUrl ? <a key={file.id} href={file.url || file.dataUrl} target="_blank" rel="noreferrer">{file.name}</a> : <span key={file.id}>{file.name}（旧附件不可打开）</span>)}</div>}{task.solutionFiles.length > 0 && <div className="design-file-links">已提交方案：{task.solutionFiles.map((file) => file.url || file.dataUrl ? <a key={file.id} href={file.url || file.dataUrl} target="_blank" rel="noreferrer">{file.name}</a> : <span key={file.id}>{file.name}（旧附件不可打开）</span>)}</div>}{task.solutionNote && <div className="design-solution-note"><strong>方案说明：</strong>{task.solutionNote}</div>}{task.versions && task.versions.length > 0 && <div className="design-meta">当前 V{task.versions.length} · 共提交 {task.versions.length} 个版本</div>}{task.feedback && <div className="design-reject-note"><strong>修改意见：</strong>{task.feedback}</div>}<div className="design-actions">{task.status === '待分配' && canAssign && <AssignDesigner task={task} designers={designers} reviewer={reviewer} onUpdate={onUpdate} />}{task.status === '待接收' && canWork && <button onClick={() => onUpdate?.(task.id, { status: '设计中' })}>开始设计</button>}{task.status === '待销售确认' && canReview && <><button onClick={() => { const at=new Date().toISOString(); onUpdate?.(task.id, { status: '客户沟通中', confirmedBy: reviewer, timeline: [...(task.timeline ?? []), { id:`timeline-${Date.now()}`, type:'审核通过', at, operator:reviewer, detail:'销售审核通过，进入客户沟通' }] }) }}>确认通过</button><button className="outline" onClick={() => { setRejectingId(task.id); setFeedback('') }}>打回修改</button></>}{task.status === '客户沟通中' && canReview && <><button onClick={() => { const at=new Date().toISOString(); onUpdate?.(task.id, { status: '已完成', completedAt:at, confirmedBy:reviewer, timeline: [...(task.timeline ?? []), { id:`timeline-${Date.now()}`, type:'客户确认', at, operator:reviewer, detail:'客户确认设计成果，任务完成' }] }) }}>客户已确认</button><button className="outline" onClick={() => { setRejectingId(task.id); setFeedback('') }}>客户要求修改</button></>}{canWork && (task.status === '设计中' || task.status === '修改中') ? <SolutionUploader task={task} onSubmit={(files, note) => onUpdate?.(task.id, { solutionFiles: files, solutionNote: note, status: '待销售确认' })} /> : null}</div>{rejectingId === task.id && <form className="design-reject-form" onSubmit={(event) => { event.preventDefault(); const value=feedback.trim(); if(!value)return; const at=new Date().toISOString(); onUpdate?.(task.id,{status:'修改中',feedback:value,timeline:[...(task.timeline??[]),{id:`timeline-${Date.now()}`,type:'退回修改',at,operator:reviewer,detail:value}]}); setRejectingId(''); setFeedback('') }}><label>修改意见（必填）<textarea required value={feedback} onChange={(event)=>setFeedback(event.target.value)} placeholder="写清楚需要调整的内容，设计师会在工作台看到"/></label><div><button type="submit">确认打回</button><button type="button" className="outline" onClick={()=>setRejectingId('')}>取消</button></div></form>}</article> })}</div>
}

function AssignDesigner({ task, designers, reviewer, onUpdate }: { task: DesignTask; designers: { id: string; name: string }[]; reviewer: string; onUpdate?: (id: string, changes: Partial<DesignTask>) => void }) {
  const [designerId, setDesignerId] = useState('')
  const designer = designers.find((item) => item.id === designerId)
  function assign() {
    if (!designer) return
    const at = new Date().toISOString()
    onUpdate?.(task.id, { designerId, designerName: designer.name, status: '待接收', assignedBy: reviewer, timeline: [...(task.timeline ?? []), { id: `timeline-${Date.now()}`, type: '任务接收', at, operator: reviewer, detail: `${reviewer || '主管'}派工给 ${designer.name}` }] })
    setDesignerId('')
  }
  return <div className="design-assign"><label>派给设计师<select aria-label="派给设计师" value={designerId} onChange={(event) => setDesignerId(event.target.value)}><option value="">选择设计师</option>{designers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" disabled={!designer} onClick={assign}>确认派工</button></div>
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
