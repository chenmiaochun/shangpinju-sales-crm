import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSalesData } from '../../store/SalesDataContext'
import type { ConfigProduct, ProductPackage } from '../../types'
import { configProductPriceRange, packagePriceRange } from '../../utils/product-config'
import { groupProducts, firstMainImage, mediaCounts, type GroupedProduct } from '../../utils/product-group'
import './product-catalog.css'

const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`

/** 从产品全名中去掉「·尺寸」后缀，只留纯净名称 */
function cleanName(raw?: string): string {
  if (!raw) return ''
  const i = raw.indexOf('·')
  return i > 0 ? raw.slice(0, i) : raw
}

type CatalogEntry = {
  kind: 'single' | 'package'
  id: string
  name: string
  code: string
  mainImage?: string
  categoryName?: string
  seriesLabel?: string
  priceText: string
  description?: string
  group?: GroupedProduct
}

export function ProductCatalogPage() {
  const sales = useSalesData()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [seriesName, setSeriesName] = useState('')

  const entries = useMemo<CatalogEntry[]>(() => {
    const groups = groupProducts(
      (sales.configProducts ?? []).filter((p) => p.status === '上架'),
      sales.skuUnits ?? [],
    )
    const singles: CatalogEntry[] = groups.map((g) => {
      const cat = sales.categories?.find((c) => c.id === g.categoryId)?.name
      const counts = mediaCounts(g.media)
      const priceText = g.priceExact ? money(g.priceMin) : `${money(g.priceMin)} 起`
      return {
        kind: 'single',
        id: g.representativeId,
        name: g.name,
        code: g.code,
        mainImage: firstMainImage(g.media),
        categoryName: cat,
        seriesLabel: g.series,
        priceText,
        description: g.description,
        group: g,
      }
    })
    const pkgs: CatalogEntry[] = (sales.productPackages ?? [])
      .filter((p) => p.status === '上架')
      .map((p) => {
        const r = packagePriceRange(p, sales.configProducts ?? [], sales.skuUnits ?? [])
        return {
          kind: 'package',
          id: p.id,
          name: p.name,
          code: p.code,
          mainImage: firstMainImage(p.media),
          categoryName: sales.categories?.find((c) => c.id === sales.configProducts?.find((pr) => pr.id === p.items?.[0]?.productId)?.categoryId)?.name,
          seriesLabel: undefined,
          priceText: r.exact ? money(r.min) : `${money(r.min)} 起`,
          description: p.description,
        }
      })
    return [...singles, ...pkgs]
  }, [sales.configProducts, sales.productPackages, sales.skuUnits, sales.categories])

  const seriesOptions = useMemo(
    () => Array.from(new Set((sales.configProducts ?? []).map((p) => p.series).filter(Boolean) as string[])),
    [sales.configProducts],
  )

  const filtered = entries.filter((e) => {
    if (keyword && !`${e.name}${e.code}`.toLowerCase().includes(keyword.toLowerCase())) return false
    if (categoryId && e.categoryName !== sales.categories?.find((c) => c.id === categoryId)?.name) return false
    if (seriesName && !(e.seriesLabel ?? '').includes(seriesName)) return false
    return true
  })

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <h1>产品目录</h1>
        <p>点开任意产品查看规格、价格、细节图与实景案例</p>
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
      </div>
      <div className="catalog-grid">
        {filtered.map((e) => {
          const counts = e.group ? mediaCounts(e.group.media) : { white: 0, scene: 0, real: 0 }
          const variantCount = e.group?.variants.length ?? 1
          return (
            <button key={`${e.kind}-${e.id}`} type="button" className="catalog-card" onClick={() => navigate(`/products/${e.id}`)}>
              <div className="catalog-card-img">
                {e.mainImage ? <img src={e.mainImage} alt={e.name} /> : <span className="catalog-noimg">暂无图片</span>}
                {variantCount > 1 && <span className="catalog-spec-badge">{variantCount} 规格</span>}
              </div>
              <div className="catalog-card-body">
                <span className={`catalog-tag catalog-tag-${e.kind}`}>{e.kind === 'single' ? '单品' : '套餐'}</span>
                <b>{cleanName(e.name)}</b>
                <small>{e.code}{e.seriesLabel ? ` · ${e.seriesLabel}` : ''}</small>
                <span className="catalog-price">{e.priceText}</span>
                {e.kind === 'single' && (
                  <span className="catalog-imgs">{counts.white} 白底 · {counts.scene} 场景 · {counts.real} 实拍</span>
                )}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && <p className="catalog-empty">没有符合条件的产品。</p>}
      </div>
    </div>
  )
}
