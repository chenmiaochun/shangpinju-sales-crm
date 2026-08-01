import { useRef, useState, type DragEvent, type FormEvent, type ReactNode, type RefObject } from 'react'
import { ChevronDown, Download, File as FileIcon, FileDown, FileImage, FileUp, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react'
import type { Customer, CustomerFile } from '../../types'
import { csvRowToCustomer, customerCsv, previewCustomerCsv, templateCsv, type CsvPreviewRow } from './csv'
import { customerImportFileToCsv } from './import-file'
import './leads.css'

export interface LeadsPageProps { customers: Customer[]; onAddCustomers: (customers: Customer[]) => void }
type FormState = { name: string; phone: string; source: string; salesperson: string; products: string[]; budget: string; renovationProgress: string; cityArea: string; vehicleBrand: string; customerStatus: string; nextFollowUpAt: string; notes: string; avatarDataUrl: string; initialQuote: string; quoteDescription: string; discountType: string; discountDetails: string; businessFiles: CustomerFile[] }
const initialForm: FormState = { name: '', phone: '', source: '', salesperson: '', products: [], budget: '待确认', renovationProgress: '', cityArea: '', vehicleBrand: '', customerStatus: '', nextFollowUpAt: '', notes: '', avatarDataUrl: '', initialQuote: '', quoteDescription: '', discountType: '', discountDetails: '', businessFiles: [] }
const SOURCES = ['抖音', '小红书', '视频号', '门店自然到店', '老客户转介绍', '设计师推荐', '异业合作', '其他']
const CITY_AREAS = ['揭阳', '汕头', '深圳', '潮州', '其他']
const SALESPEOPLE = ['陈婉珊', '吴漫东', '郭予旭', '其他']
const PRODUCTS = ['沙发', '茶台', '餐桌', '床', '全屋定制', '其他']
const BUDGETS = ['待确认', '2 万以下', '2-5 万', '5-8 万', '8-15 万', '15 万以上']
const BUDGET_AMOUNTS: Record<string, number> = { '2 万以下': 20000, '2-5 万': 50000, '5-8 万': 80000, '8-15 万': 150000, '15 万以上': 200000 }
const RENOVATION_PROGRESS = ['未开工', '硬装中', '硬装完成', '已入住补购', '未交房']
const CUSTOMER_STATUS = ['首次到店', '持续跟进', '已成交', '已流失']
const STATUS_STAGE: Record<string, Customer['stage']> = { '首次到店': '到店', '持续跟进': '需求确认', '已成交': '已成交', '已流失': '已流失' }
const VEHICLE_BRANDS = ['比亚迪', '特斯拉', '宝马', '丰田', '其他']
const DISCOUNT_TYPES = ['无', '门店专场活动', '老客转介绍折扣', '专属议价优惠', '节日活动', '其他']

export function LeadsPage({ customers, onAddCustomers }: LeadsPageProps) {
  const [form, setForm] = useState(initialForm)
  const [preview, setPreview] = useState<CsvPreviewRow[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const businessFileInput = useRef<HTMLInputElement>(null)
  const validRows = preview.filter((row) => row.errors.length === 0)
  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault()
    const missing = [!form.name.trim() && '姓名', !form.salesperson && '负责人'].filter(Boolean)
    if (missing.length) { setNotice(`请先补充：${missing.join('、')}`); return }
    const now = new Date()
    const quote = Number(form.initialQuote)
    const customer: Customer = { id: `lead-${now.getTime()}`, name: form.name.trim(), phone: form.phone.trim(), source: form.source, salesperson: form.salesperson, stage: STATUS_STAGE[form.customerStatus] ?? '新线索', intent: form.customerStatus === '已成交' ? '高' : '中', expectedAmount: quote > 0 ? quote : BUDGET_AMOUNTS[form.budget] ?? 0, products: form.products, style: '', budget: form.budget, renovationProgress: form.renovationProgress, concerns: [], cityArea: form.cityArea, vehicleBrand: form.vehicleBrand, notes: form.notes.trim(), avatarDataUrl: form.avatarDataUrl || undefined, initialQuote: quote > 0 ? quote : undefined, quoteDescription: form.quoteDescription.trim() || undefined, discountType: form.discountType || undefined, discountDetails: form.discountDetails.trim() || undefined, businessFiles: form.businessFiles, lastContactAt: now.toISOString(), nextFollowUpAt: form.nextFollowUpAt ? new Date(`${form.nextFollowUpAt}T09:00:00`).toISOString() : undefined, createdAt: now.toISOString().slice(0, 10) }
    onAddCustomers([customer]); setForm(initialForm); if (avatarInput.current) avatarInput.current.value = ''; if (businessFileInput.current) businessFileInput.current.value = ''; setNotice(`已新增客户：${customer.name}`)
  }
  async function selectAvatar(file?: File) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return
    update('avatarDataUrl', await cropAvatar(file))
  }
  function addBusinessFiles(files: FileList | File[]) {
    const incoming = Array.from(files).map((file) => ({ id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: file.name, type: file.type || file.name.split('.').pop()?.toUpperCase() || '文件', size: file.size }))
    update('businessFiles', [...form.businessFiles, ...incoming].filter((file, index, items) => items.findIndex((item) => item.name === file.name && item.size === file.size) === index))
  }
  function dropBusinessFiles(event: DragEvent<HTMLDivElement>) { event.preventDefault(); addBusinessFiles(event.dataTransfer.files) }
  async function selectFile(file?: File) {
    if (!file) return
    try {
      const result = previewCustomerCsv(await customerImportFileToCsv(file))
      setFileName(file.name); setPreview(result.rows); setFileErrors(result.fileErrors); setNotice('')
    } catch (error) {
      setFileName(file.name); setPreview([]); setFileErrors([error instanceof Error ? error.message : '文件读取失败']); setNotice('')
    }
  }
  function confirmImport() {
    if (!validRows.length || preview.some((row) => row.errors.length)) return
    onAddCustomers(validRows.map((row) => csvRowToCustomer(row)))
    setNotice(`已导入 ${validRows.length} 位客户`); clearPreview()
  }
  function clearPreview() { setPreview([]); setFileErrors([]); setFileName(''); if (fileInput.current) fileInput.current.value = '' }

  return <section className="leads-page" aria-label="线索数据中心">
    <header className="leads-header">
      <div><p>客户经营</p><h1>线索数据中心</h1><span>统一录入、校验和导出客户资料</span></div>
      <div className="leads-actions">
        <button type="button" className="secondary" onClick={() => download('客户导入模板.csv', templateCsv())}><FileDown size={17} />下载模板</button>
        <button type="button" className="secondary" onClick={() => download('客户数据.csv', customerCsv(customers))}><Download size={17} />导出客户</button>
      </div>
    </header>
    {notice && <div className="leads-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}><X size={15} /></button></div>}
    <main className="leads-layout">
      <section className="leads-panel">
        <div className="panel-heading"><Plus size={19} /><div><h2>新增客户</h2><p>建立一条可立即跟进的新线索</p></div></div>
        <form className="lead-form" noValidate onSubmit={submit}>
          <div className="form-section-title"><strong>基础信息</strong><span>客户身份与归属</span></div>
          <div className="basic-grid full-width"><div className="basic-column"><Field label="姓名" required><input required value={form.name} onChange={(e) => update('name', e.target.value)} /></Field><Field label="所在城市"><ChoiceSelect value={form.cityArea} options={CITY_AREAS} placeholder="请选择城市" onChange={(value) => update('cityArea', value)} /></Field></div><div className="basic-column"><AvatarUpload value={form.avatarDataUrl} inputRef={avatarInput} onSelect={(file) => void selectAvatar(file)} onDelete={() => update('avatarDataUrl', '')}/><Field label="电话"><input type="tel" pattern="[+0-9][0-9 -]{5,19}" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="选填" /></Field><Field label="负责人" required><ChoiceSelect required value={form.salesperson} options={SALESPEOPLE} placeholder="请选择负责人" onChange={(value) => update('salesperson', value)} /></Field></div></div>
          <div className="form-section-title"><strong>业务信息</strong><span>跟进判断与客户需求</span></div>
          <Field label="预算范围"><ChoiceSelect value={form.budget} options={BUDGETS} onChange={(value) => update('budget', value)} /></Field>
          <ProductSelect values={form.products} onChange={(values) => update('products', values)} />
          <Field label="客户来源"><ChoiceSelect value={form.source} options={SOURCES} placeholder="请选择客户来源" onChange={(value) => update('source', value)} /></Field>
          <Field label="客户状态"><ChoiceSelect value={form.customerStatus} options={CUSTOMER_STATUS} placeholder="请选择客户状态" onChange={(value) => update('customerStatus', value)} /></Field>
          <Field label="装修进度"><ChoiceSelect value={form.renovationProgress} options={RENOVATION_PROGRESS} placeholder="请选择装修进度" onChange={(value) => update('renovationProgress', value)} /></Field>
          <Field label="下次跟进时间"><input type="date" value={form.nextFollowUpAt} onChange={(e) => update('nextFollowUpAt', e.target.value)} /></Field>
          <Field label="车辆品牌"><ChoiceSelect value={form.vehicleBrand} options={VEHICLE_BRANDS} placeholder="请选择车辆品牌" onChange={(value) => update('vehicleBrand', value)} /></Field>
          <div className="form-section-title"><strong>跟进资料</strong><span>报价、优惠及客户资料登记</span></div>
          <div className="followup-column"><Field label="初步报价金额"><div className="money-input"><input min="0" step="1" type="number" value={form.initialQuote} onChange={(event) => update('initialQuote', event.target.value)} placeholder="例：58000"/><span>元</span></div></Field><Field label="报价说明"><input value={form.quoteDescription} onChange={(event) => update('quoteDescription', event.target.value)} placeholder="简要说明报价包含的产品范围"/></Field></div>
          <div className="followup-column"><Field label="优惠类型"><ChoiceSelect value={form.discountType} options={DISCOUNT_TYPES} placeholder="请选择优惠类型" onChange={(value) => update('discountType', value)}/></Field><Field label="优惠详情"><input value={form.discountDetails} onChange={(event) => update('discountDetails', event.target.value)} placeholder="例：满减 5000、整单 95 折"/></Field></div>
          <BusinessFileUpload files={form.businessFiles} inputRef={businessFileInput} onAdd={addBusinessFiles} onDrop={dropBusinessFiles} onDelete={(id) => update('businessFiles', form.businessFiles.filter((file) => file.id !== id))}/>
          <Field label="备注" className="full-width"><textarea rows={2} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="可填写客户特殊需求、到店细节等补充信息" /></Field>
          <div className="form-submit"><span>仅姓名和负责人为必填项，其他信息可以后续补充</span><button className="primary" type="submit"><Plus size={17} />保存并进入客户跟进</button></div>
        </form>
      </section>
      <section className="leads-panel import-panel">
        <div className="panel-heading"><Upload size={18} /><div><h2>批量导入</h2><p>校验后写入客户资料</p></div></div>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => void selectFile(e.target.files?.[0])} />
        {!fileName ? <button className="drop-zone" type="button" onClick={() => fileInput.current?.click()}><FileUp size={19} /><strong>选择 Excel / CSV 文件</strong><span>上传后自动校验</span><small>支持 XLSX、XLS、UTF-8 CSV</small></button> : <>
          <div className="file-bar"><span><FileUp size={17} />{fileName}</span><button type="button" onClick={clearPreview} aria-label="移除文件"><X size={17} /></button></div>
          {fileErrors.map((error) => <p className="file-error" role="alert" key={error}>{error}</p>)}
          {preview.length > 0 && <div className="preview-summary"><span>共 {preview.length} 行</span><span className="valid">有效 {validRows.length}</span><span className={preview.length === validRows.length ? '' : 'invalid'}>错误 {preview.length - validRows.length}</span></div>}
          <button type="button" className="primary confirm-import" disabled={!validRows.length || preview.some((row) => row.errors.length > 0)} onClick={confirmImport}>确认导入 {validRows.length ? `${validRows.length} 条` : ''}</button>
        </>}
      </section>
    </main>
  </section>
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) { return <label className={className}><span>{label}{required && <b> *</b>}</span>{children}</label> }
function ChoiceSelect({ value, options, placeholder, required, onChange }: { value: string; options: string[]; placeholder?: string; required?: boolean; onChange: (value: string) => void }) { return <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> }
function ProductSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) { return <label className="product-field"><span>意向产品</span><details className="product-select"><summary>{values.length ? values.join(' | ') : '请选择意向产品'}<ChevronDown size={15} /></summary><div>{PRODUCTS.map((option) => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={() => onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option])} />{option}</label>)}</div></details></label> }
function AvatarUpload({ value, inputRef, onSelect, onDelete }: { value: string; inputRef: RefObject<HTMLInputElement | null>; onSelect: (file?: File) => void; onDelete: () => void }) { return <div className="avatar-upload"><span>客户头像</span><input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onSelect(event.target.files?.[0])}/><div className="avatar-frame">{value ? <img src={value} alt="客户头像预览"/> : <button type="button" onClick={() => inputRef.current?.click()}><ImagePlus size={24}/></button>}{value && <div className="avatar-overlay"><button type="button" onClick={() => inputRef.current?.click()}>重新上传</button><button type="button" onClick={onDelete}>删除</button></div>}</div><small>点击上传客户照片</small></div> }
function BusinessFileUpload({ files, inputRef, onAdd, onDrop, onDelete }: { files: CustomerFile[]; inputRef: RefObject<HTMLInputElement | null>; onAdd: (files: FileList | File[]) => void; onDrop: (event: DragEvent<HTMLDivElement>) => void; onDelete: (id: string) => void }) { return <div className="business-upload full-width"><span>业务资料上传</span><input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.cad,.zip" onChange={(event) => event.target.files && onAdd(event.target.files)}/><div className="business-drop" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><FileUp size={21}/><p>可上传客户提供的平面图、效果图、户型图、报价单等业务资料</p><button type="button" onClick={() => inputRef.current?.click()}>选择文件</button></div>{files.length > 0 && <div className="business-files">{files.map((file) => <div key={file.id}>{file.type.startsWith('image/') ? <FileImage size={15}/> : <FileIcon size={15}/>}<span title={file.name}>{file.name}<small>{formatFileSize(file.size)}</small></span><button type="button" aria-label={`删除 ${file.name}`} onClick={() => onDelete(file.id)}><Trash2 size={14}/></button></div>)}</div>}</div> }
async function cropAvatar(file: File): Promise<string> { const source = await readDataUrl(file); const image = await loadImage(source); const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160; const context = canvas.getContext('2d'); if (!context) return source; const side = Math.min(image.naturalWidth, image.naturalHeight); context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 160, 160); return canvas.toDataURL('image/jpeg', .82) }
function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }) }
function loadImage(source: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source }) }
function formatFileSize(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
function download(name: string, content: string) { const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url) }

export default LeadsPage
