import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Maximize2, QrCode, Camera, Tag, Layers } from 'lucide-react'
import QRCode from 'qrcode'
import { salesApi, type PublicProductDetail, type RemoteCase } from '../../api/salesApi'
import { useSalesData } from '../../store/SalesDataContext'
import type { ConfigProduct, ConfigProductComponent, MediaFile, SkuUnit } from '../../types'
import {
  availableCount,
  configProductAvailability,
  configProductPrice,
  configProductPriceRange,
  findSkuUnit,
  matchingSkuUnits,
} from '../../utils/product-config'
import './product-detail.css'

const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`

interface NormalizedCase {
  id: string
  title: string
  category: string
  images: RemoteCase['images']
  note: string
  tags: string[]
}
interface ProdMedia {
  whiteBgImages?: MediaFile[]
  detailImages?: MediaFile[]
  realShotImages?: MediaFile[]
  images?: MediaFile[]
}
interface NormalizedProduct {
  id: string
  name: string
  code: string
  description?: string
  materialDescription?: string
  series?: string
  categoryName?: string
  applicableSpace?: string[]
  adjustPrice: number
  components: ConfigProductComponent[]
  media: ProdMedia
  skuUnits: SkuUnit[]
  cases: NormalizedCase[]
}

// 给定规格选择，算整套可售库存（按各必选主件对应 SKU 最小可用量）
function stockForSelection(product: ConfigProduct, skuUnits: SkuUnit[], selections: Record<string, Record<string, string>>): number {
  let stock = Infinity
  for (const comp of product.components) {
    if (comp.optional) continue
    const sel = selections[comp.componentId] ?? comp.locked ?? {}
    const unit = findSkuUnit(skuUnits, comp.componentId, sel)
    if (!unit) return 0
    const avail = availableCount(unit)
    if (avail <= 0) return 0
    stock = Math.min(stock, avail)
  }
  return stock === Infinity ? 0 : stock
}

// 枚举单品「规格行」：以首个多取值非可选主件为主规格维度
function buildSpecRows(product: ConfigProduct, skuUnits: SkuUnit[]): { specLabel: string; price: number; stock: number; selections: Record<string, Record<string, string>> }[] {
  const required = product.components.filter((c) => !c.optional)
  if (!required.length) return []
  const mainComp = required.find((c) => matchingSkuUnits(skuUnits, c.componentId, c.locked, c.allowed).length > 1) ?? required[0]
  const mainUnits = matchingSkuUnits(skuUnits, mainComp.componentId, mainComp.locked, mainComp.allowed)
  const seen = new Set<string>()
  const rows: { specLabel: string; price: number; stock: number; selections: Record<string, Record<string, string>> }[] = []
  for (const u of mainUnits) {
    const key = JSON.stringify(u.specValues)
    if (seen.has(key)) continue
    seen.add(key)
    const selections: Record<string, Record<string, string>> = { [mainComp.componentId]: u.specValues }
    for (const c of required) {
      if (c.componentId === mainComp.componentId) continue
      const sel = c.locked && Object.keys(c.locked).length ? c.locked : (matchingSkuUnits(skuUnits, c.componentId, c.locked, c.allowed)[0]?.specValues || {})
      selections[c.componentId] = sel
    }
    rows.push({
      specLabel: Object.values(u.specValues).join(' · '),
      price: configProductPrice(product, skuUnits, selections),
      stock: stockForSelection(product, skuUnits, selections),
      selections,
    })
  }
  return rows
}

function toCalcProduct(p: NormalizedProduct): ConfigProduct {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    categoryId: '',
    description: p.description,
    style: undefined,
    series: p.series,
    materialDescription: p.materialDescription,
    applicableSpace: p.applicableSpace,
    sortOrder: 0,
    media: p.media as ConfigProduct['media'],
    components: p.components,
    adjustPrice: p.adjustPrice,
    status: '上架',
  }
}

function normalizeCases(cases: RemoteCase[]): NormalizedCase[] {
  return cases.map((c) => ({ id: c.id, title: c.title, category: c.category, images: c.images, note: c.note, tags: c.tags || [] }))
}

function ProductDetailView({ product, readOnly }: { product: NormalizedProduct; readOnly: boolean }) {
  const navigate = useNavigate()
  const calc = useMemo(() => toCalcProduct(product), [product])
  const priceRange = useMemo(() => configProductPriceRange(calc, product.skuUnits), [calc, product.skuUnits])
  const availability = useMemo(() => configProductAvailability(calc, product.skuUnits), [calc, product.skuUnits])
  const specRows = useMemo(() => buildSpecRows(calc, product.skuUnits), [calc, product.skuUnits])
  const [selected, setSelected] = useState(0)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)

  const hero = product.media.whiteBgImages?.[0]?.url ?? product.media.images?.[0]?.url
  const detailImages = product.media.detailImages ?? []
  const realImages = product.media.realShotImages ?? []
  const tags = useMemo(() => {
    const set = new Set<string>()
    if (product.series) set.add(product.series)
    for (const c of product.cases) for (const t of c.tags) if (t) set.add(t)
    return Array.from(set)
  }, [product])

  const showSpec = specRows.length > 1
  const selPrice = showSpec ? specRows[selected]?.price ?? priceRange.min : priceRange.min
  const selStock = showSpec ? specRows[selected]?.stock ?? availability.stock : availability.stock
  const stockText = selStock === Number.MAX_SAFE_INTEGER ? '接单生产' : `库存 ${selStock}`

  const openQr = async () => {
    const url = `${window.location.origin}/p/${product.id}`
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 })
      setQr(dataUrl)
    } catch {
      setQr(null)
    }
  }

  return (
    <div className={`pd-page${readOnly ? ' pd-readonly' : ''}`}>
      <header className="pd-head">
        {readOnly ? (
          <span className="pd-brand">尚品居 · 产品详情</span>
        ) : (
          <button type="button" className="pd-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> 返回产品目录
          </button>
        )}
        {!readOnly && (
          <button type="button" className="pd-qr-btn" onClick={openQr}>
            <QrCode size={16} /> 生成二维码
          </button>
        )}
      </header>

      <div className="pd-body">
        <div className="pd-hero" onClick={() => hero && setLightbox(hero)}>
          {hero ? <img src={hero} alt={product.name} /> : <span className="pd-noimg">暂无图片</span>}
          {hero && <button type="button" className="pd-hero-zoom" aria-label="放大"><Maximize2 size={16} /></button>}
        </div>

        <div className="pd-info">
          <h1>{product.name}</h1>
          <div className="pd-meta">
            {product.materialDescription && <span>材质：{product.materialDescription}</span>}
            <span>编码：{product.code}</span>
            {product.categoryName && <span>品类：{product.categoryName}</span>}
            {product.series && <span>系列：{product.series}</span>}
            {product.applicableSpace?.length ? <span>适用：{product.applicableSpace.join('、')}</span> : null}
          </div>

          <div className="pd-price-row">
            <b className="pd-price">{money(selPrice)}</b>
            {!priceRange.exact && <span className="pd-price-from">起</span>}
            <span className="pd-stock">{stockText}</span>
          </div>

          {showSpec && (
            <div className="pd-spec">
              <div className="pd-spec-title">选择规格</div>
              <div className="pd-spec-list">
                {specRows.map((row, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`pd-spec-item${idx === selected ? ' active' : ''}`}
                    onClick={() => setSelected(idx)}
                  >
                    <span>{row.specLabel}</span>
                    <span className="pd-spec-price">{money(row.price)}</span>
                    <span className="pd-spec-stock">{row.stock === Number.MAX_SAFE_INTEGER ? '接单' : `库存 ${row.stock}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.description && <p className="pd-desc">{product.description}</p>}

          {detailImages.length > 0 && (
            <section className="pd-gallery">
              <h3><Layers size={15} /> 细节图</h3>
              <div className="pd-thumbs">
                {detailImages.map((img) => (
                  <button key={img.id} type="button" className="pd-thumb" onClick={() => setLightbox(img.url)}>
                    <img src={img.url} alt={img.name} loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {realImages.length > 0 && (
            <section className="pd-gallery">
              <h3><Camera size={15} /> 实拍图 / 实景图</h3>
              <div className="pd-thumbs">
                {realImages.map((img) => (
                  <button key={img.id} type="button" className="pd-thumb" onClick={() => setLightbox(img.url)}>
                    <img src={img.url} alt={img.name} loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {product.cases.length > 0 && (
            <section className="pd-gallery">
              <h3><Camera size={15} /> 实景案例（{product.cases.length}）</h3>
              {!readOnly && (
                <button
                  type="button"
                  className="pd-case-btn"
                  onClick={() => navigate(`/cases?productId=${encodeURIComponent(product.id)}&productName=${encodeURIComponent(product.name)}`)}
                >
                  查看全部关联案例 →
                </button>
              )}
              <div className="pd-thumbs">
                {product.cases.flatMap((c) => c.images).slice(0, 12).map((img, i) => (
                  <button key={i} type="button" className="pd-thumb" onClick={() => setLightbox(img.url)}>
                    <img src={img.url} alt={img.name} loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <section className="pd-tags">
              <h3><Tag size={15} /> 相关标签</h3>
              <div className="pd-tag-list">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="pd-tag"
                    onClick={() => readOnly ? undefined : navigate(`/cases?tag=${encodeURIComponent(t)}`)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="预览" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="pd-lightbox-close" onClick={() => setLightbox(null)}>×</button>
        </div>
      )}

      {qr && (
        <div className="pd-qr-modal" onClick={() => setQr(null)}>
          <div className="pd-qr-card" onClick={(e) => e.stopPropagation()}>
            <h3>产品二维码</h3>
            <p>打印贴价格标签，客户扫码即可查看本产品详情</p>
            <img src={qr} alt="产品二维码" />
            <a className="pd-qr-download" href={qr} download={`${product.code || product.name}-二维码.png`}>下载二维码图片</a>
            <button type="button" className="pd-ghost-btn" onClick={() => setQr(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 内部入口（需 catalog.view）：从 SalesDataContext 取数，可跳案例库、可生成二维码
export function ProductDetailPage() {
  const { id = '' } = useParams()
  const sales = useSalesData()
  const [cases, setCases] = useState<RemoteCase[]>([])
  const product = useMemo(() => sales.configProducts?.find((p) => p.id === id), [sales.configProducts, id])

  useEffect(() => {
    if (!id || !product) return
    let alive = true
    salesApi.listCases({ productId: id, productName: product.name })
      .then((res) => { if (alive) setCases(res.cases) })
      .catch(() => { if (alive) setCases([]) })
    return () => { alive = false }
  }, [id, product])

  if (!product) return <div className="pd-empty">未找到该产品（{id}）</div>
  const normalized: NormalizedProduct = {
    id: product.id,
    name: product.name,
    code: product.code,
    description: product.description,
    materialDescription: product.materialDescription,
    series: product.series,
    categoryName: sales.categories?.find((c) => c.id === product.categoryId)?.name,
    applicableSpace: product.applicableSpace,
    adjustPrice: product.adjustPrice,
    components: product.components,
    media: product.media || {},
    skuUnits: sales.skuUnits?.filter((u) => product.components.some((c) => c.componentId === u.componentId)) ?? [],
    cases: normalizeCases(cases),
  }
  return <ProductDetailView product={normalized} readOnly={false} />
}

// 公开入口（免登录）：客户扫码进入，只读展示，从专用接口取数
export function PublicProductPage() {
  const { id = '' } = useParams()
  const [detail, setDetail] = useState<PublicProductDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let alive = true
    setDetail(null)
    setError('')
    salesApi.getPublicProduct(id)
      .then((res) => { if (alive) setDetail(res) })
      .catch(() => { if (alive) setError('未找到该产品') })
    return () => { alive = false }
  }, [id])

  if (error) return <div className="pd-empty">{error}</div>
  if (!detail) return <div className="pd-empty">加载中…</div>
  const normalized: NormalizedProduct = {
    id: detail.id,
    name: detail.name,
    code: detail.code,
    description: detail.description,
    materialDescription: detail.materialDescription,
    series: detail.series,
    categoryName: detail.categoryName,
    applicableSpace: detail.applicableSpace,
    adjustPrice: detail.adjustPrice ?? 0,
    components: detail.components as unknown as ConfigProductComponent[],
    media: detail.media || {},
    skuUnits: detail.skuUnits as unknown as SkuUnit[],
    cases: detail.cases.map((c) => ({ id: c.id, title: c.title, category: c.category, images: c.images, note: c.note, tags: c.tags || [] })),
  }
  return <ProductDetailView product={normalized} readOnly />
}
