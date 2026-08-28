import { useMemo, useState } from 'react'
import { useSalesData } from '../../store/SalesDataContext'
import type { ConfigProduct, MediaFile, ProductMedia, ProductPackage } from '../../types'
import { configProductPriceRange, packagePriceRange } from '../../utils/product-config'
import './product-catalog.css'

const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`

type CatalogEntry = {
  kind: 'single' | 'package'
  id: string
  name: string
  code: string
  mainImage?: string
  categoryName?: string
  seriesLabel?: string
  styleLabel?: string
  priceText: string
  media?: ProductMedia
  description?: string
  applicableSpace?: string[]
}

function firstPackageCategoryId(p: ProductPackage, products: ConfigProduct[]): string | undefined {
  const first = p.items[0]
  if (!first) return undefined
  return products.find((pr) => pr.id === first.productId)?.categoryId
}
function pkgSeriesLabel(p: ProductPackage, products: ConfigProduct[]): string | undefined {
  return p.items.map((it) => products.find((pr) => pr.id === it.productId)?.series).filter(Boolean)[0]
}
function pkgStyleLabel(p: ProductPackage, products: ConfigProduct[]): string | undefined {
  return p.items.map((it) => products.find((pr) => pr.id === it.productId)?.style).filter(Boolean)[0]
}

export function ProductCatalogPage() {
  const sales = useSalesData()
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [seriesName, setSeriesName] = useState('')
  const [styleName, setStyleName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const entries = useMemo<CatalogEntry[]>(() => {
    const singles: CatalogEntry[] = (sales.configProducts ?? [])
      .filter((p) => p.status === '上架')
      .map((p) => {
        const r = configProductPriceRange(p, sales.skuUnits ?? [])
        const priceText = r.exact ? money(r.min) : `${money(r.min)} ~ ${money(r.max)}`
        return {
          kind: 'single',
          id: p.id,
          name: p.name,
          code: p.code,
          mainImage: p.media?.images?.[0]?.url,
          categoryName: sales.categories?.find((c) => c.id === p.categoryId)?.name,
          seriesLabel: p.series,
          styleLabel: p.style,
          priceText,
          media: p.media,
          description: p.description,
          applicableSpace: p.applicableSpace,
        }
      })
    const pkgs: CatalogEntry[] = (sales.productPackages ?? [])
      .filter((p) => p.status === '上架')
      .map((p) => {
        const r = packagePriceRange(p, sales.configProducts ?? [], sales.skuUnits ?? [])
        const priceText = r.exact ? money(r.min) : `${money(r.min)} ~ ${money(r.max)}`
        return {
          kind: 'package',
          id: p.id,
          name: p.name,
          code: p.code,
          mainImage: p.media?.images?.[0]?.url,
          categoryName: sales.categories?.find((c) => c.id === firstPackageCategoryId(p, sales.configProducts ?? []))?.name,
          seriesLabel: pkgSeriesLabel(p, sales.configProducts ?? []),
          styleLabel: pkgStyleLabel(p, sales.configProducts ?? []),
          priceText,
          media: p.media,
          description: p.description,
        }
      })
    return [...singles, ...pkgs]
  }, [sales.configProducts, sales.productPackages, sales.skuUnits, sales.categories])

  const seriesOptions = useMemo(
    () => Array.from(new Set((sales.configProducts ?? []).map((p) => p.series).filter(Boolean) as string[])),
    [sales.configProducts],
  )
  const styleOptions = useMemo(
    () => Array.from(new Set((sales.configProducts ?? []).map((p) => p.style).filter(Boolean) as string[])),
    [sales.configProducts],
  )

  const filtered = entries.filter((e) => {
    if (keyword && !`${e.name}${e.code}`.toLowerCase().includes(keyword.toLowerCase())) return false
    if (categoryId && e.categoryName !== sales.categories?.find((c) => c.id === categoryId)?.name) return false
    if (seriesName && !(e.seriesLabel ?? '').includes(seriesName)) return false
    if (styleName && !(e.styleLabel ?? '').includes(styleName)) return false
    return true
  })

  const open = entries.find((e) => e.id === openId)

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <h1>产品目录</h1>
        <p>全员可查看的产品图文资料（展示成品价，成本不公开）</p>
      </header>
      <div className="catalog-filters">
        <input
          className="catalog-search"
          placeholder="搜索名称 / 编码"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="按品类筛选">
          <option value="">全部品类</option>
          {(sales.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={seriesName} onChange={(event) => setSeriesName(event.target.value)} aria-label="按系列筛选">
          <option value="">全部系列</option>
          {seriesOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={styleName} onChange={(event) => setStyleName(event.target.value)} aria-label="按风格筛选">
          <option value="">全部风格</option>
          {styleOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="catalog-grid">
        {filtered.map((e) => (
          <button key={`${e.kind}-${e.id}`} type="button" className="catalog-card" onClick={() => setOpenId(e.id)}>
            <div className="catalog-card-img">
              {e.mainImage ? <img src={e.mainImage} alt={e.name} /> : <span className="catalog-noimg">暂无图片</span>}
            </div>
            <div className="catalog-card-body">
              <span className={`catalog-tag catalog-tag-${e.kind}`}>{e.kind === 'single' ? '单品' : '套餐'}</span>
              <b>{e.name}</b>
              <small>
                {e.code}
                {e.categoryName ? ` · ${e.categoryName}` : ''}
                {e.seriesLabel ? ` · ${e.seriesLabel}` : ''}
              </small>
              <span className="catalog-price">{e.priceText}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="catalog-empty">没有符合条件的产品。</p>}
      </div>
      {open && <CatalogDrawer entry={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function CatalogDrawer({ entry, onClose }: { entry: CatalogEntry; onClose: () => void }) {
  const m = entry.media
  const gallery: MediaFile[] = [
    ...(m?.images ?? []),
    ...(m?.dimensionImages ?? []),
    ...(m?.materialImages ?? []),
    ...(m?.colorImages ?? []),
  ]
  const docs = [...(m?.installationDoc ?? []), ...(m?.careDoc ?? []), ...(m?.manualFiles ?? [])]
  return (
    <div
      className="catalog-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.name} 详情`}
      onClick={onClose}
    >
      <aside className="catalog-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{entry.name}</h2>
          <button type="button" onClick={onClose} aria-label="关闭详情">
            ×
          </button>
        </header>
        <div className="catalog-drawer-body">
          {entry.mainImage && <img className="catalog-hero" src={entry.mainImage} alt={entry.name} />}
          <div className="catalog-meta">
            <span>编码：{entry.code}</span>
            {entry.categoryName && <span>品类：{entry.categoryName}</span>}
            {entry.seriesLabel && <span>系列：{entry.seriesLabel}</span>}
            {entry.styleLabel && <span>风格：{entry.styleLabel}</span>}
            {entry.applicableSpace?.length ? <span>适用空间：{entry.applicableSpace.join('、')}</span> : null}
            <span className="catalog-price">{entry.priceText}</span>
          </div>
          {entry.description && <p className="catalog-desc">{entry.description}</p>}
          {gallery.length > 0 && (
            <div className="catalog-gallery">
              {gallery.map((g) => (
                <img key={g.id} src={g.url} alt={g.name} />
              ))}
            </div>
          )}
          {m?.qualityStandard && (
            <div className="catalog-block">
              <h3>质检标准</h3>
              <p>{m.qualityStandard}</p>
            </div>
          )}
          {docs.length > 0 && (
            <div className="catalog-block">
              <h3>安装 / 保养 / 手册</h3>
              <ul>
                {docs.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
