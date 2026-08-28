import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Clock3, FileImage, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import type { CustomerFile, DesignTask, DesignTaskStatus } from '../../types'
import { salesApi } from '../../api/salesApi'
import type { TeamMember } from '../team'
import './designer-workspace.css'
import './designer-detail.css'
import './upload-feedback.css'

type WorkspaceFilter = '全部' | '今天' | '待接收' | '进行中' | '被打回' | '待确认' | '已完成' | '已逾期'

export interface DesignerWorkspacePageProps {
  tasks: DesignTask[]
  activeMember: TeamMember
  onUpdateTask: (id: string, changes: Partial<DesignTask>) => void
  now?: Date
}

const filters: WorkspaceFilter[] = ['全部', '待接收', '进行中', '被打回', '待确认', '已完成', '已逾期']

function isDesignerTask(task: DesignTask, member: TeamMember) {
  return task.designerId === member.id || task.designerName === member.name
}

function isOverdue(task: DesignTask, now: Date) {
  return task.status !== '已完成' && new Date(task.dueAt).getTime() < now.getTime()
}

function isDueToday(task: DesignTask, now: Date) {
  const due = new Date(task.dueAt)
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate()
}

function isDueSoon(task: DesignTask, now: Date) {
  const remaining = new Date(task.dueAt).getTime() - now.getTime()
  return remaining >= 0 && remaining <= 24 * 60 * 60 * 1000
}

function matchesFilter(task: DesignTask, filter: WorkspaceFilter, now: Date) {
  if (filter === '全部') return true
  if (filter === '今天') return isDueToday(task, now) && task.status !== '已完成'
  if (filter === '待接收') return task.status === '待接收'
  if (filter === '进行中') return task.status === '设计中'
  if (filter === '被打回') return task.status === '修改中'
  if (filter === '待确认') return task.status === '待销售确认' || task.status === '客户沟通中'
  if (filter === '已完成') return task.status === '已完成'
  return isOverdue(task, now)
}

function displayStatus(status: DesignTaskStatus) {
  if (status === '设计中') return '进行中'
  if (status === '修改中') return '被打回'
  if (status === '待销售确认' || status === '客户沟通中') return '待确认'
  return status
}

function formatDue(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function UploadResult({ task, onUpdate }: { task: DesignTask; onUpdate: DesignerWorkspacePageProps['onUpdateTask'] }) {
  const [files, setFiles] = useState<CustomerFile[]>(task.solutionFiles)
  const [note, setNote] = useState(task.solutionNote ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function choose(selected: File[]) {
    setUploading(true); setError(''); setMessage('')
    try { const uploaded = await Promise.all(selected.map((file) => salesApi.uploadFile(file, task.id, 'design-result').then((result) => result.file))); setFiles(uploaded); setMessage(`已选择并上传 ${uploaded.length} 个成果文件，请填写说明后提交`) }
    catch { setError('文件上传失败，请检查文件大小或联系管理员后重试') }
    finally { setUploading(false) }
  }
  function submit() {
    const at = new Date().toISOString(), version = (task.versions?.length ?? 0) + 1
    onUpdate(task.id, { solutionFiles: files, solutionNote: note, status: '待销售确认', feedback: undefined, versions: [...(task.versions ?? []), { id: `version-${Date.now()}`, version, files, note, submittedAt: at, submittedBy: task.designerName }], timeline: [...(task.timeline ?? []), { id: `timeline-${Date.now()}`, type: '提交成果', at, operator: task.designerName, detail: `提交 V${version}：${note || '无方案说明'}` }] })
  }
  return <div className="designer-submit-panel">
    <input id={`designer-result-${task.id}`} className="visually-hidden" type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.cad,.zip" onChange={(event) => void choose(Array.from(event.target.files ?? []))} />
    <label htmlFor={`designer-result-${task.id}`}><FileImage size={16} />{uploading ? '上传中...' : '选择成果文件'}</label>
    <input aria-label="方案说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写本次方案说明" />
    <button type="button" disabled={!files.length || uploading} onClick={submit}><Send size={15} />提交成果</button>
    {files.length > 0 && <small>{files.map((file) => file.name).join('、')}</small>}
    {message && <small className="upload-success">{message}</small>}
    {error && <small className="text-danger">{error}</small>}
  </div>
}

export function DesignerWorkspacePage({ tasks, activeMember, onUpdateTask, now = new Date() }: DesignerWorkspacePageProps) {
  const [filter, setFilter] = useState<WorkspaceFilter>('全部')
  const [submittingId, setSubmittingId] = useState('')
  const [detailId, setDetailId] = useState('')
  const mine = useMemo(() => tasks.filter((task) => isDesignerTask(task, activeMember)), [tasks, activeMember])
  const counts = useMemo(() => ({
    待接收: mine.filter((task) => task.status === '待接收').length,
    进行中: mine.filter((task) => task.status === '设计中').length,
    被打回: mine.filter((task) => task.status === '修改中').length,
    待确认: mine.filter((task) => task.status === '待销售确认' || task.status === '客户沟通中').length,
    已完成: mine.filter((task) => task.status === '已完成' && new Date(task.updatedAt).getFullYear() === now.getFullYear() && new Date(task.updatedAt).getMonth() === now.getMonth()).length,
    已逾期: mine.filter((task) => isOverdue(task, now)).length,
  }), [mine, now])
  const visible = mine.filter((task) => matchesFilter(task, filter, now)).sort((a, b) => {
    if (isOverdue(a, now) !== isOverdue(b, now)) return isOverdue(a, now) ? -1 : 1
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  })
  const recent = mine.filter((task) => task.status === '已完成').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6)

  const statCards: Array<{ label: '待接收' | '进行中' | '被打回' | '待确认' | '已完成' | '已逾期'; value: number }> = [
    { label: '待接收', value: counts.待接收 }, { label: '进行中', value: counts.进行中 },
    { label: '被打回', value: counts.被打回 }, { label: '待确认', value: counts.待确认 },
    { label: '已完成', value: counts.已完成 }, { label: '已逾期', value: counts.已逾期 },
  ]

  return <main className="designer-workspace">
    <header className="designer-workspace-hero">
      <div><p>设计协作</p><h1>我的工作台</h1><span>设计师：{activeMember.name} · 今天需要处理 {counts.待接收 + counts.进行中 + counts.被打回} 项工作</span></div>
      <Sparkles size={34} />
    </header>

    <section className="designer-stats" aria-label="设计任务统计">
      {statCards.map((card) => <button type="button" key={card.label} className={card.label === '已逾期' ? 'danger' : ''} onClick={() => setFilter(card.label)}><span>{card.label === '已完成' ? '已完成（本月）' : card.label}</span><strong>{card.value}</strong><small>个任务</small></button>)}
    </section>

    <section className="designer-quick-actions" aria-label="快捷操作">
      <button type="button" onClick={() => setFilter('今天')}><CalendarClock size={18} /><span>今天要交</span><strong>{mine.filter((task) => isDueToday(task, now) && task.status !== '已完成').length}</strong></button>
      <button type="button" onClick={() => setFilter('被打回')}><RotateCcw size={18} /><span>被打回待修改</span><strong>{counts.被打回}</strong></button>
      <div><Clock3 size={18} /><span>最近提交</span><strong>{mine.filter((task) => task.status === '待销售确认' || task.status === '客户沟通中').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.customerName ?? '暂无'}</strong></div>
    </section>

    <section className="designer-task-section">
      <header><div><h2>我的设计任务</h2><p>按计划完成时间排序，逾期任务优先显示</p></div><span>共 {visible.length} 项</span></header>
      <nav className="designer-filter-tabs" aria-label="设计任务状态">
        {filters.map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
      </nav>
      <div className="designer-task-grid">
        {visible.map((task) => {
          const overdue = isOverdue(task, now)
          const dueSoon = isDueSoon(task, now)
          return <article key={task.id} className={`designer-work-card${overdue ? ' overdue' : dueSoon ? ' due-soon' : ''}`}>
            <header><div><h3>{task.customerName}</h3><span>{task.type}</span></div><b className={`workspace-status status-${task.status}`}>{displayStatus(task.status)}</b></header>
            <p className="designer-work-requirement">{task.requirement}</p>
            <dl><div><dt>销售负责人</dt><dd>{task.salesperson}</dd></div><div><dt>计划完成</dt><dd className={overdue ? 'text-danger' : dueSoon ? 'text-warning' : ''}>{formatDue(task.dueAt)} {overdue && '· 已逾期'}</dd></div><div><dt>紧急程度</dt><dd><i className={`priority-${task.priority}`}>{task.priority}</i></dd></div><div><dt>参考资料</dt><dd>{task.referenceFiles.length} 个</dd></div></dl>
            {task.feedback && <aside className="designer-feedback"><strong>修改意见</strong><p>{task.feedback}</p></aside>}
            <footer>
              {task.status === '待接收' && <button type="button" onClick={() => { const at = new Date().toISOString(); onUpdateTask(task.id, { status: '设计中', acceptedAt: at, timeline: [...(task.timeline ?? []), { id: `timeline-${Date.now()}`, type: '任务接收', at, operator: activeMember.name, detail: '设计师接收任务并开始设计' }] }) }}>接收并开始设计</button>}
              {(task.status === '设计中' || task.status === '修改中') && <button type="button" onClick={() => setSubmittingId(submittingId === task.id ? '' : task.id)}>提交成果</button>}
              {task.status === '修改中' && <button type="button" className="outline" onClick={() => setSubmittingId(task.id)}>查看修改意见</button>}
              <button type="button" className="outline" onClick={() => setDetailId(task.id)}>查看任务</button>
            </footer>
            {submittingId === task.id && (task.status === '设计中' || task.status === '修改中') && <UploadResult task={task} onUpdate={(id, changes) => { onUpdateTask(id, changes); setSubmittingId('') }} />}
          </article>
        })}
        {!visible.length && <div className="designer-empty"><CheckCircle2 size={30} /><strong>这个分类暂无任务</strong><span>可以切换其他标签查看工作安排</span></div>}
      </div>
    </section>

    <section className="designer-results">
      <header><div><h2>我的成果库</h2><p>最近完成的设计任务</p></div><button type="button" onClick={() => setFilter('已完成')}>查看全部</button></header>
      <div className="designer-result-grid">{recent.map((task) => {
        const image = task.solutionFiles.find((file) => file.type.startsWith('image/') && (file.url || file.dataUrl))
        return <article key={task.id}><div className="result-thumb">{image ? <img src={image.url || image.dataUrl} alt={`${task.customerName}设计成果`} /> : <FileImage size={28} />}</div><div><strong>{task.customerName} · {task.type}</strong><span>{new Date(task.updatedAt).toLocaleDateString('zh-CN')} 完成</span><small>{task.solutionFiles.length} 个成果文件</small></div></article>
      })}{!recent.length && <p className="designer-result-empty">完成并确认的任务会自动进入成果库</p>}</div>
    </section>
    {detailId && <DesignerTaskDetail task={mine.find((task) => task.id === detailId)!} onClose={() => setDetailId('')} />}
  </main>
}

function FileLink({ file }: { file: CustomerFile }) {
  const href = file.url || file.dataUrl
  if (!href) return <span>{file.name}（旧附件无可用文件）</span>
  if (file.type.startsWith('image/')) return <a className="detail-image-file" href={href} target="_blank" rel="noreferrer"><img src={href} alt={file.name}/><strong>{file.name}</strong><small>点击查看原图</small></a>
  return <a href={href} target="_blank" rel="noreferrer">{file.name} · 查看或下载</a>
}

function DesignerTaskDetail({ task, onClose }: { task: DesignTask; onClose: () => void }) {
  return <div className="designer-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="designer-detail" role="dialog" aria-modal="true" aria-label={`设计任务详情 ${task.customerName}`}><header><div><p>{task.type} · {displayStatus(task.status)}</p><h2>{task.customerName}的设计任务</h2></div><button type="button" aria-label="关闭任务详情" onClick={onClose}><X size={20}/></button></header><div className="designer-detail-body"><section><h3>任务要求</h3><p>{task.requirement}</p><dl><div><dt>设计师</dt><dd>{task.designerName}</dd></div><div><dt>销售负责人</dt><dd>{task.salesperson}</dd></div><div><dt>计划完成</dt><dd>{formatDue(task.dueAt)}</dd></div><div><dt>紧急程度</dt><dd>{task.priority}</dd></div></dl></section><section><h3>参考资料</h3><div className="detail-file-list">{task.referenceFiles.map((file) => <FileLink key={file.id} file={file}/>)}{!task.referenceFiles.length && <span>暂无参考资料</span>}</div></section>{task.feedback && <section className="designer-feedback"><h3>最新修改意见</h3><p>{task.feedback}</p></section>}<section><h3>成果版本</h3>{(task.versions ?? []).slice().reverse().map((version) => <article className="version-card" key={version.id}><strong>V{version.version}</strong><span>{new Date(version.submittedAt).toLocaleString('zh-CN')} · {version.submittedBy}</span><p>{version.note || '无方案说明'}</p><div className="detail-file-list">{version.files.map((file) => <FileLink key={file.id} file={file}/>)}</div></article>)}{!task.versions?.length && <p>尚未提交成果</p>}</section><section><h3>流程时间线</h3><ol className="design-timeline">{(task.timeline ?? []).map((event) => <li key={event.id}><strong>{event.type}</strong><span>{event.detail}</span><small>{event.operator} · {new Date(event.at).toLocaleString('zh-CN')}</small></li>)}</ol></section></div></section></div>
}

export default DesignerWorkspacePage
