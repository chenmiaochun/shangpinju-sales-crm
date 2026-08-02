import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, ClipboardPaste, FileImage, FileText, ImagePlus, MessageSquareText, RotateCcw, Send, Sparkles, Trash2, Upload } from 'lucide-react'
import type { Customer, CustomerRemarkImage, FollowUp } from '../../types'
import { analyzeConversation, type ConversationField } from './analyzer'
import './conversation.css'
import './conversation-import.css'

export interface ConversationAnalyzerPageProps {
  customers: Customer[]
  onApplyAnalysis: (customerId: string, customerPatch: Partial<Customer>, followUp: FollowUp) => void
}

const SAMPLE = `客户：我们新房正在做水电，想做全屋定制，风格喜欢现代简约。
客户：预算大概15万左右，希望下个月能装，工期会不会来不及？
客户：价格如果合适，周末我和老公一起到店看方案，麻烦先发几个案例。`

const LABELS: Record<ConversationField, string> = { budget: '预算', products: '意向产品', style: '偏好风格', renovationProgress: '装修进度', delivery: '期望交期', decisionMaker: '决策人', objections: '异议', buyingSignals: '购买信号', sentiment: '沟通情绪', commitments: '承诺事项' }
const MAX_SCREENSHOTS = 6
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024

function readImage(file: File): Promise<CustomerRemarkImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ id: `chat-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, dataUrl: String(reader.result) })
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

export function ConversationAnalyzerPage({ customers, onApplyAnalysis }: ConversationAnalyzerPageProps) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [text, setText] = useState('')
  const [submittedText, setSubmittedText] = useState('')
  const [applied, setApplied] = useState(false)
  const [screenshots, setScreenshots] = useState<CustomerRemarkImage[]>([])
  const [uploadError, setUploadError] = useState('')
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const analysis = useMemo(() => submittedText ? analyzeConversation(submittedText) : null, [submittedText])
  const customer = customers.find((item) => item.id === customerId)

  function runAnalysis() { setApplied(false); setSubmittedText(text.trim()) }
  async function addScreenshots(files: FileList | null) {
    if (!files?.length) return
    setUploadError('')
    const remaining = MAX_SCREENSHOTS - screenshots.length
    const selected = Array.from(files).slice(0, remaining)
    const invalid = selected.find((file) => !file.type.startsWith('image/') || file.size > MAX_SCREENSHOT_SIZE)
    if (invalid) {
      setUploadError('仅支持 JPG、PNG 等图片格式，单张不能超过 5MB。')
      return
    }
    if (files.length > remaining) setUploadError(`最多上传 ${MAX_SCREENSHOTS} 张聊天截图。`)
    try {
      const images = await Promise.all(selected.map(readImage))
      setScreenshots((current) => [...current, ...images])
      setApplied(false)
    } catch {
      setUploadError('截图读取失败，请重新选择。')
    } finally {
      if (screenshotInputRef.current) screenshotInputRef.current.value = ''
    }
  }
  function apply() {
    if (!analysis || !customer) return
    const fields = analysis.fields
    const patch: Partial<Customer> = {
      stage: analysis.suggestedStage,
      intent: fields.buyingSignals.evidence.length >= 2 ? '高' : fields.buyingSignals.evidence.length ? '中' : customer.intent,
      budget: fields.budget.evidence.length ? fields.budget.value : customer.budget,
      products: fields.products.evidence.length ? fields.products.value.split('、') : customer.products,
      style: fields.style.evidence.length ? fields.style.value : customer.style,
      renovationProgress: fields.renovationProgress.evidence.length ? fields.renovationProgress.value : customer.renovationProgress,
      concerns: fields.objections.evidence.length ? Array.from(new Set([...customer.concerns, ...fields.objections.value.split('、')])) : customer.concerns,
      remarkImages: screenshots.length ? [...(customer.remarkImages ?? []), ...screenshots] : customer.remarkImages,
      lastContactAt: new Date().toISOString(),
    }
    const screenshotNote = screenshots.length ? `\n\n[微信聊天截图：${screenshots.map((item) => item.name).join('、')}]` : ''
    const followUp: FollowUp = { id: `conversation-${Date.now()}`, customerId, at: patch.lastContactAt!, channel: '微信', content: `${submittedText}${screenshotNote}`, result: analysis.summary, nextAction: analysis.nextTasks.join('；'), salesperson: customer.salesperson }
    onApplyAnalysis(customerId, patch, followUp)
    setApplied(true)
  }

  return <main className="conversation-page" aria-labelledby="conversation-title">
    <header className="conversation-header"><div><p>沟通智能分析</p><h1 id="conversation-title">把客户原话变成可执行跟进</h1><span>基于确定性本地规则分析，不会上传沟通内容，也不代表在线 AI 判断。</span></div><MessageSquareText aria-hidden="true" /></header>
    <section className="conversation-input" aria-label="沟通内容输入">
      <div className="conversation-controls"><label>分析客户<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">请选择客户</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stage}</option>)}</select></label><button type="button" className="secondary" onClick={() => { setText(SAMPLE); setSubmittedText(''); setApplied(false) }}><FileText />载入示例</button><button type="button" className="icon-button" title="清空内容" aria-label="清空内容" onClick={() => { setText(''); setSubmittedText(''); setScreenshots([]); setUploadError(''); setApplied(false) }}><RotateCcw /></button></div>
      <label className="conversation-textarea"><span><ClipboardPaste />微信或电话沟通文本</span><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴客户与销售的沟通记录，建议保留换行以便定位证据……" rows={9} /></label>
      <section className="conversation-screenshots" aria-labelledby="chat-screenshot-title">
        <div className="conversation-upload-heading"><div><span id="chat-screenshot-title"><FileImage />微信聊天截图</span><small>选填，作为原始沟通凭证保存到客户档案</small></div><strong>{screenshots.length} / {MAX_SCREENSHOTS}</strong></div>
        {screenshots.length > 0 && <div className="conversation-screenshot-grid">{screenshots.map((image) => <article key={image.id}><img src={image.dataUrl} alt={`聊天截图 ${image.name}`} /><div><span title={image.name}>{image.name}</span><button type="button" className="icon-button" aria-label={`删除截图 ${image.name}`} title="删除截图" onClick={() => { setScreenshots((current) => current.filter((item) => item.id !== image.id)); setApplied(false) }}><Trash2 /></button></div></article>)}</div>}
        <input ref={screenshotInputRef} className="conversation-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="选择微信聊天截图" onChange={(event) => void addScreenshots(event.target.files)} />
        <button type="button" className="conversation-upload-button" disabled={screenshots.length >= MAX_SCREENSHOTS} onClick={() => screenshotInputRef.current?.click()}><ImagePlus /><span>选择聊天截图<small>支持 JPG、PNG，单张不超过 5MB</small></span><Upload /></button>
        {uploadError && <p className="conversation-upload-error" role="alert">{uploadError}</p>}
      </section>
      <div className="conversation-input-footer"><small>{text.length} 字</small><button type="button" className="primary" disabled={!text.trim()} onClick={runAnalysis}><Sparkles />开始本地分析</button></div>
    </section>

    {!analysis ? <section className="conversation-empty"><Sparkles /><h2>等待分析内容</h2><p>选择客户并粘贴沟通文本，结果会在这里按原文证据展开。</p></section> : <>
      <section className="conversation-overview"><div><small>沟通摘要</small><h2>{analysis.summary}</h2><p>共定位 {analysis.evidenceCount} 条原文证据</p></div><div><small>建议客户阶段</small><strong>{analysis.suggestedStage}</strong></div></section>
      <section className="conversation-findings" aria-label="关键信息提取">{(Object.keys(LABELS) as ConversationField[]).map((key) => { const field = analysis.fields[key]; return <article key={key} className={field.evidence.length ? '' : 'is-missing'}><header><span>{LABELS[key]}</span><strong>{field.value}</strong></header>{field.evidence.length ? <div className="evidence-list">{field.evidence.map((item, index) => <blockquote key={`${item.line}-${index}`}><b>原文 · 第 {item.line} 行</b><p>{item.quote}</p></blockquote>)}</div> : <p className="missing-copy">原文未发现明确信息</p>}</article> })}</section>
      <div className="conversation-actions-grid"><section><h2>成交阻碍</h2>{analysis.blockers.length ? <ul>{analysis.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : <p>未发现明确阻碍，仍建议人工确认。</p>}</section><section><h2>下一步任务</h2><ol>{analysis.nextTasks.map((item) => <li key={item}>{item}</li>)}</ol></section></div>
      <section className="conversation-message"><div><small>可直接发送的话术</small><p>{analysis.suggestedMessage}</p></div><button type="button" className="icon-button" title="复制话术" aria-label="复制话术" onClick={() => navigator.clipboard?.writeText(analysis.suggestedMessage)}><Send /></button></section>
      <section className="conversation-apply"><div><h2>确认回写客户档案</h2><p>将更新阶段和已提取需求，新增一条微信跟进记录{screenshots.length ? `，并保存 ${screenshots.length} 张聊天截图` : ''}。未提及的字段保持原值。</p></div><button type="button" className="primary" disabled={!customer || applied} onClick={apply}>{applied ? <><CheckCircle2 />已回写</> : '确认并回写'}</button></section>
    </>}
  </main>
}

export default ConversationAnalyzerPage
