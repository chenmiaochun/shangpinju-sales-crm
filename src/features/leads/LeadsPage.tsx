import { useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode, type RefObject } from 'react'
import { ArrowRight, Check, ChevronDown, Download, File as FileIcon, FileDown, FileImage, FileUp, Images, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import type { Customer, CustomerFile, CustomerRemarkImage } from '../../types'
import { csvRowToCustomer, customerCsv, previewCustomerCsv, templateCsv, type CsvPreviewRow } from './csv'
import { customerImportFileToCsv } from './import-file'
import { findVehiclePrice, VEHICLE_BRANDS, vehicleSeriesFor } from './vehicle-catalog'
import { CITY_REFERENCE_PRICE, communitiesForCity, estimateHouseValue, GENERAL_HOUSING_LAYOUTS } from './housing-catalog'
import './leads.css'

export interface LeadsPageProps { customers: Customer[]; onAddCustomers: (customers: Customer[]) => void }
type FormState = { name: string; phone: string; licenseProvince: string; licenseLetter: string; licenseNumber: string; source: string; salesperson: string; products: string[]; budget: string; renovationProgress: string; cityArea: string; communityId: string; customCommunityName: string; buildingRoom: string; houseLayout: string; houseArea: string; vehicleBrand: string; vehicleSeries: string; customerStatus: string; nextFollowUpAt: string; notes: string; remarkImages: CustomerRemarkImage[]; initialQuote: string; quoteDescription: string; discountType: string; discountDetails: string; businessFiles: CustomerFile[] }
const initialForm: FormState = { name: '', phone: '', licenseProvince: '粤', licenseLetter: 'V', licenseNumber: '', source: '', salesperson: '', products: [], budget: '待确认', renovationProgress: '', cityArea: '', communityId: '', customCommunityName: '', buildingRoom: '', houseLayout: '', houseArea: '', vehicleBrand: '', vehicleSeries: '', customerStatus: '', nextFollowUpAt: '', notes: '', remarkImages: [], initialQuote: '', quoteDescription: '', discountType: '', discountDetails: '', businessFiles: [] }
const LICENSE_PROVINCES = ['粤', '京', '津', '沪', '渝', '冀', '豫', '云', '辽', '黑', '湘', '皖', '鲁', '新', '苏', '浙', '赣', '鄂', '桂', '甘', '晋', '蒙', '陕', '吉', '闽', '贵', '青', '藏', '川', '宁', '琼']
const LICENSE_LETTERS = ['V', 'U', 'D', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((letter) => !['V', 'U', 'D'].includes(letter))]
const SOURCES = ['抖音', '小红书', '视频号', '门店自然到店', '老客户转介绍', '设计师推荐', '异业合作', '其他']
const CITY_AREAS = ['揭阳', '汕头', '深圳', '潮州', '其他']
const SALESPEOPLE = ['陈婉珊', '吴漫东', '郭予旭', '其他']
const PRODUCTS = [
  '沙发', '单椅/休闲椅', '茶几', '茶台', '电视柜',
  '餐桌', '餐椅', '餐边柜', '床', '床头柜',
  '床垫', '床品', '衣柜', '梳妆台', '书桌/书柜',
  '窗帘', '地毯', '灯具', '挂画', '软装饰品',
  '绿植', '全屋定制', '其他',
]
const BUDGETS = ['待确认', '2 万以下', '2-5 万', '5-8 万', '8-15 万', '15 万以上']
const BUDGET_AMOUNTS: Record<string, number> = { '2 万以下': 20000, '2-5 万': 50000, '5-8 万': 80000, '8-15 万': 150000, '15 万以上': 200000 }
const RENOVATION_PROGRESS = ['未开工', '硬装中', '硬装完成', '已入住补购', '未交房']
const CUSTOMER_STATUS = ['首次到店', '持续跟进', '已成交', '已流失']
const STATUS_STAGE: Record<string, Customer['stage']> = { '首次到店': '到店', '持续跟进': '需求确认', '已成交': '已成交', '已流失': '已流失' }
const DISCOUNT_TYPES = ['无', '门店专场活动', '老客转介绍折扣', '专属议价优惠', '节日活动', '其他']

export function LeadsPage({ customers, onAddCustomers }: LeadsPageProps) {
  const [form, setForm] = useState(initialForm)
  const [customerLookup, setCustomerLookup] = useState('')
  const [preview, setPreview] = useState<CsvPreviewRow[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const remarkImageInput = useRef<HTMLInputElement>(null)
  const businessFileInput = useRef<HTMLInputElement>(null)
  const validRows = preview.filter((row) => row.errors.length === 0)
  const lookupMatches = useMemo(() => {
    const keyword = normalizeLookup(customerLookup)
    if (!keyword) return []
    return customers.filter((customer) => [customer.name, customer.phone, customer.licensePlate].some((value) => normalizeLookup(value).includes(keyword))).slice(0, 6)
  }, [customerLookup, customers])
  const vehicleSeries = vehicleSeriesFor(form.vehicleBrand)
  const vehiclePriceRange = findVehiclePrice(form.vehicleBrand, form.vehicleSeries)
  const communities = communitiesForCity(form.cityArea)
  const selectedCommunity = communities.find((item) => item.id === form.communityId)
  const housingLayouts = selectedCommunity?.layouts ?? GENERAL_HOUSING_LAYOUTS
  const houseValueRange = estimateHouseValue(selectedCommunity?.averagePrice ?? CITY_REFERENCE_PRICE[form.cityArea] ?? CITY_REFERENCE_PRICE.其他, Number(form.houseArea))
  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault()
    const missing = [!form.name.trim() && '姓名', !form.salesperson && '负责人'].filter(Boolean)
    if (missing.length) { setNotice(`请先补充：${missing.join('、')}`); return }
    const now = new Date()
    const quote = Number(form.initialQuote)
    const licenseNumber = form.licenseNumber.trim().toUpperCase()
    const customer: Customer = { id: `lead-${now.getTime()}`, name: form.name.trim(), phone: form.phone.trim(), licensePlate: licenseNumber ? `${form.licenseProvince}${form.licenseLetter}${licenseNumber}` : '', source: form.source, salesperson: form.salesperson, stage: STATUS_STAGE[form.customerStatus] ?? '新线索', intent: form.customerStatus === '已成交' ? '高' : '中', expectedAmount: quote > 0 ? quote : BUDGET_AMOUNTS[form.budget] ?? 0, products: form.products, style: '', budget: form.budget, renovationProgress: form.renovationProgress, concerns: [], cityArea: form.cityArea, communityName: selectedCommunity?.name || form.customCommunityName.trim() || undefined, communityDistrict: selectedCommunity?.district, buildingRoom: form.buildingRoom.trim() || undefined, houseLayout: form.houseLayout || undefined, houseArea: Number(form.houseArea) || undefined, houseValueRange: houseValueRange || undefined, vehicleBrand: form.vehicleBrand.trim(), vehicleSeries: form.vehicleSeries.trim() || undefined, vehiclePriceRange: vehiclePriceRange || undefined, notes: form.notes.trim(), remarkImages: form.remarkImages, initialQuote: quote > 0 ? quote : undefined, quoteDescription: form.quoteDescription.trim() || undefined, discountType: form.discountType || undefined, discountDetails: form.discountDetails.trim() || undefined, businessFiles: form.businessFiles, lastContactAt: now.toISOString(), nextFollowUpAt: form.nextFollowUpAt ? new Date(`${form.nextFollowUpAt}T09:00:00`).toISOString() : undefined, createdAt: now.toISOString().slice(0, 10) }
    onAddCustomers([customer]); setForm(initialForm); if (remarkImageInput.current) remarkImageInput.current.value = ''; if (businessFileInput.current) businessFileInput.current.value = ''; setNotice(`已新增客户：${customer.name}`); window.location.hash = `/customers?customer=${encodeURIComponent(customer.id)}`
  }
  async function addRemarkImages(files?: FileList | null) {
    if (!files) return
    const remaining = Math.max(0, 12 - form.remarkImages.length)
    const images = await Promise.all(Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, remaining).map(async (file) => ({ id: `remark-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: file.name, dataUrl: await compressImage(file) })))
    update('remarkImages', [...form.remarkImages, ...images]); if (files.length > remaining) setNotice('单个客户最多保存 12 张备注图片')
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
          <Field label="姓名" required><input required value={form.name} onChange={(e) => update('name', e.target.value)} /></Field>
          <Field label="电话"><input type="tel" pattern="[+0-9][0-9 -]{5,19}" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="选填" /></Field>
          <Field label="车牌号码"><div className="license-plate-input"><select aria-label="车牌省份" value={form.licenseProvince} onChange={(event) => update('licenseProvince', event.target.value)}>{LICENSE_PROVINCES.map((province) => <option key={province}>{province}</option>)}</select><select aria-label="车牌字母" value={form.licenseLetter} onChange={(event) => update('licenseLetter', event.target.value)}>{LICENSE_LETTERS.map((letter) => <option key={letter}>{letter}</option>)}</select><input aria-label="车牌后五位" maxLength={6} value={form.licenseNumber} onChange={(event) => update('licenseNumber', event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} placeholder="例：12345" /></div></Field>
          <Field label="所在城市"><ChoiceSelect value={form.cityArea} options={CITY_AREAS} placeholder="请选择城市" onChange={(value) => setForm((current) => ({ ...current, cityArea:value, communityId:'', customCommunityName:'', houseLayout:'', houseArea:'' }))} /></Field>
          <Field label="负责人" required><ChoiceSelect required value={form.salesperson} options={SALESPEOPLE} placeholder="请选择负责人" onChange={(value) => update('salesperson', value)} /></Field>
          <RemarkImageUpload images={form.remarkImages} inputRef={remarkImageInput} onAdd={(files) => void addRemarkImages(files)} onDelete={(id) => update('remarkImages', form.remarkImages.filter((image) => image.id !== id))}/>
          <div className="form-section-title"><strong>小区与户型</strong><span>用于判断空间需求和客户消费能力</span></div>
          <Field label="小区名称"><select aria-label="小区名称" value={form.communityId} onChange={(event) => setForm((current) => ({ ...current, communityId:event.target.value, customCommunityName:'', houseLayout:'', houseArea:'' }))}><option value="">请选择小区</option>{communities.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.district}</option>)}<option value="other">其他小区（手动填写）</option></select></Field>
          <Field label="楼栋 / 房号"><input value={form.buildingRoom} onChange={(event) => update('buildingRoom', event.target.value)} placeholder="例如：8栋 1202"/></Field>
          {form.communityId === 'other' && <Field label="其他小区名称"><input value={form.customCommunityName} onChange={(event) => update('customCommunityName', event.target.value)} placeholder="请输入完整小区名称"/></Field>}
          <Field label="对应户型"><select aria-label="对应户型" value={form.houseLayout} onChange={(event) => { const layout = housingLayouts.find((item) => item.name === event.target.value); setForm((current) => ({ ...current, houseLayout:event.target.value, houseArea:layout ? String(layout.area) : current.houseArea })) }}><option value="">请选择户型</option>{housingLayouts.map((layout) => <option key={layout.name} value={layout.name}>{layout.name} · 约 {layout.area}㎡</option>)}</select></Field>
          <Field label="建筑面积（㎡）"><input type="number" min="20" max="2000" step="1" value={form.houseArea} onChange={(event) => update('houseArea', event.target.value)} placeholder="选择户型后自动带出，可修改"/></Field>
          <div className={houseValueRange ? 'house-value matched' : 'house-value'}><span>房产参考价值</span><strong>{houseValueRange || '选择小区和户型后自动估算'}</strong><small>{selectedCommunity ? `${selectedCommunity.name} · ${selectedCommunity.district}` : '仅用于内部客群判断，不作为正式房产估价'}</small></div>
          <div className="form-section-title"><strong>业务信息</strong><span>跟进判断与客户需求</span></div>
          <Field label="预算范围"><ChoiceSelect value={form.budget} options={BUDGETS} onChange={(value) => update('budget', value)} /></Field>
          <ProductSelect values={form.products} onChange={(values) => update('products', values)} />
          <Field label="客户来源"><ChoiceSelect value={form.source} options={SOURCES} placeholder="请选择客户来源" onChange={(value) => update('source', value)} /></Field>
          <Field label="客户状态"><ChoiceSelect value={form.customerStatus} options={CUSTOMER_STATUS} placeholder="请选择客户状态" onChange={(value) => update('customerStatus', value)} /></Field>
          <Field label="装修进度"><ChoiceSelect value={form.renovationProgress} options={RENOVATION_PROGRESS} placeholder="请选择装修进度" onChange={(value) => update('renovationProgress', value)} /></Field>
          <Field label="下次跟进时间"><input type="date" value={form.nextFollowUpAt} onChange={(e) => update('nextFollowUpAt', e.target.value)} /></Field>
          <Field label="车辆品牌与车系" className="vehicle-field"><div className="vehicle-picker"><input list="vehicle-brand-options" aria-label="车辆品牌" value={form.vehicleBrand} onChange={(event) => setForm((current) => ({ ...current, vehicleBrand: event.target.value, vehicleSeries: '' }))} placeholder="选择或输入品牌"/><datalist id="vehicle-brand-options">{VEHICLE_BRANDS.map((brand) => <option key={brand} value={brand}/>)}</datalist><input list="vehicle-series-options" aria-label="车辆系列" value={form.vehicleSeries} onChange={(event) => update('vehicleSeries', event.target.value)} placeholder={form.vehicleBrand ? '输入或选择车系' : '请先选择品牌'}/><datalist id="vehicle-series-options">{vehicleSeries.map((series) => <option key={series.name} value={series.name}>{series.priceRange}</option>)}</datalist><span className={vehiclePriceRange ? 'vehicle-price matched' : 'vehicle-price'}>{vehiclePriceRange ? `参考新车价 ${vehiclePriceRange}` : form.vehicleSeries ? '未匹配到参考价，可继续保存' : '选择车系后自动显示参考价位'}</span></div></Field>
          <div className="form-section-title"><strong>跟进资料</strong><span>报价、优惠及客户资料登记</span></div>
          <div className="followup-column"><Field label="初步报价金额"><div className="money-input"><input min="0" step="1" type="number" value={form.initialQuote} onChange={(event) => update('initialQuote', event.target.value)} placeholder="例：58000"/><span>元</span></div></Field><Field label="报价说明"><input value={form.quoteDescription} onChange={(event) => update('quoteDescription', event.target.value)} placeholder="简要说明报价包含的产品范围"/></Field></div>
          <div className="followup-column"><Field label="优惠类型"><ChoiceSelect value={form.discountType} options={DISCOUNT_TYPES} placeholder="请选择优惠类型" onChange={(value) => update('discountType', value)}/></Field><Field label="优惠详情"><input value={form.discountDetails} onChange={(event) => update('discountDetails', event.target.value)} placeholder="例：满减 5000、整单 95 折"/></Field></div>
          <BusinessFileUpload files={form.businessFiles} inputRef={businessFileInput} onAdd={addBusinessFiles} onDrop={dropBusinessFiles} onDelete={(id) => update('businessFiles', form.businessFiles.filter((file) => file.id !== id))}/>
          <Field label="备注" className="full-width"><textarea rows={2} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="可填写客户特殊需求、到店细节等补充信息" /></Field>
          <div className="form-submit"><span className={notice ? 'submit-feedback' : ''} aria-live="polite">{notice || '仅姓名和负责人为必填项，其他信息可以后续补充'}</span><button className="primary" type="submit"><Plus size={17} />保存并进入客户跟进</button></div>
        </form>
      </section>
      <aside className="leads-side-tools" aria-label="线索辅助工具">
        <CustomerLookup query={customerLookup} matches={lookupMatches} onQuery={setCustomerLookup} onOpen={(id) => { window.location.hash = `/customers?customer=${encodeURIComponent(id)}` }}/>
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
      </aside>
    </main>
  </section>
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) { return <label className={className}><span>{label}{required && <b> *</b>}</span>{children}</label> }
function CustomerLookup({ query, matches, onQuery, onOpen }: { query: string; matches: Customer[]; onQuery: (value: string) => void; onOpen: (id: string) => void }) { return <section className="customer-lookup"><div className="lookup-title"><Search size={18}/><div><strong>先查找老客户</strong><span>客户再次到店时，可输入手机号、姓名或车牌号码调出原有资料</span></div></div><label><Search size={16}/><input aria-label="查找老客户" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="输入手机号、姓名或车牌号，例如 粤V12345"/>{query && <button type="button" aria-label="清空查找" onClick={() => onQuery('')}><X size={15}/></button>}</label>{query && <div className="lookup-results">{matches.length ? matches.map((customer) => <button type="button" key={customer.id} onClick={() => onOpen(customer.id)}><span className="lookup-avatar">{customer.name.slice(0, 1)}</span><span><strong>{customer.name}</strong><small>{customer.phone || '未登记电话'}{customer.licensePlate ? ` · ${customer.licensePlate}` : ''}</small></span><em>{customer.stage} · {customer.salesperson}</em><ArrowRight size={16}/></button>) : <p>没有找到旧客户，可以继续新建资料。</p>}</div>}</section> }
function ChoiceSelect({ value, options, placeholder, required, onChange }: { value: string; options: string[]; placeholder?: string; required?: boolean; onChange: (value: string) => void }) { return <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> }
function ProductSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  return <div className="product-field"><span>意向产品</span><details ref={detailsRef} className="product-select">
    <summary>{values.length ? values.join(' | ') : '请选择意向产品'}<ChevronDown size={15} /></summary>
    <div className="product-menu">
      <div className="product-options">{PRODUCTS.map((option) => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={() => onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option])} />{option}</label>)}</div>
      <footer><span>已选 {values.length} 项</span><button type="button" onClick={() => detailsRef.current?.removeAttribute('open')}><Check size={15}/>确定</button></footer>
    </div>
  </details></div>
}
function RemarkImageUpload({ images, inputRef, onAdd, onDelete }: { images: CustomerRemarkImage[]; inputRef: RefObject<HTMLInputElement | null>; onAdd: (files?: FileList | null) => void; onDelete: (id: string) => void }) { return <div className="remark-images full-width"><div className="remark-images-heading"><span>备注资料图片</span><small>车辆、车牌、现场或其他需要留档的照片，最多 12 张</small></div><input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/*" onChange={(event) => onAdd(event.target.files)}/><div className="remark-gallery">{images.map((image) => <figure key={image.id}><img src={image.dataUrl} alt={image.name}/><figcaption>{image.name}</figcaption><button type="button" aria-label={`删除图片 ${image.name}`} onClick={() => onDelete(image.id)}><Trash2 size={14}/></button></figure>)}{images.length < 12 && <button className="add-remark-image" type="button" onClick={() => inputRef.current?.click()}><Images size={22}/><span>{images.length ? '继续添加' : '添加备注图片'}</span></button>}</div></div> }
function BusinessFileUpload({ files, inputRef, onAdd, onDrop, onDelete }: { files: CustomerFile[]; inputRef: RefObject<HTMLInputElement | null>; onAdd: (files: FileList | File[]) => void; onDrop: (event: DragEvent<HTMLDivElement>) => void; onDelete: (id: string) => void }) { return <div className="business-upload full-width"><span>业务资料上传</span><input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.cad,.zip" onChange={(event) => event.target.files && onAdd(event.target.files)}/><div className="business-drop" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><FileUp size={21}/><p>可上传客户提供的平面图、效果图、户型图、报价单等业务资料</p><button type="button" onClick={() => inputRef.current?.click()}>选择文件</button></div>{files.length > 0 && <div className="business-files">{files.map((file) => <div key={file.id}>{file.type.startsWith('image/') ? <FileImage size={15}/> : <FileIcon size={15}/>}<span title={file.name}>{file.name}<small>{formatFileSize(file.size)}</small></span><button type="button" aria-label={`删除 ${file.name}`} onClick={() => onDelete(file.id)}><Trash2 size={14}/></button></div>)}</div>}</div> }
async function compressImage(file: File): Promise<string> { const source = await readDataUrl(file); const image = await loadImage(source); const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); const context = canvas.getContext('2d'); if (!context) return source; context.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', .72) }
function normalizeLookup(value?: string) { return String(value ?? '').toLowerCase().replace(/[\s-]/g, '') }
function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }) }
function loadImage(source: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source }) }
function formatFileSize(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
function download(name: string, content: string) { const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url) }

export default LeadsPage
