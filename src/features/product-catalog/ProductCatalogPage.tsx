import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSalesData } from '../../store/SalesDataContext'
import type { ConfigProduct, ProductPackage } from '../../types'
import { configProductPriceRange, packagePriceRange } from '../../utils/product-config'
import { groupProducts, firstMainImage, mediaCounts, type GroupedProduct } from '../../utils/product-group'
import { TAG_LEVELS, SCENE_OPTIONS, STYLE_OPTIONS, entryTagsForLevel, type TagLevelId } from '../../utils/product-tags'
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
  scenes?: string[]
  style?: string
  priceText: string
  description?: string
  group?: GroupedProduct
}

export function ProductCatalogPage() {
  const sales = useSalesData()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  // 四级多选：每级一个选中的值集合
  const [sel, setSel] = useState<Record<TagLevelId, Set<string>>>({
    category: new Set(),
    series: new Set(),
    scene: new Set(),
    style: new Set(),
  })

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
        scenes: g.applicableSpace,
        style: g.style,
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
          scenes: undefined,
          style: undefined,
          priceText: r.exact ? money(r.min) : `${money(r.min)} 起`,
          description: p.description,
        }
      })
    return [...singles, ...pkgs]
  }, [sales.configProducts, sales.productPackages, sales.skuUnits, sales.categories])

  // 各级可选项
  const categoryOptions = useMemo(() => (sales.categories ?? []).map((c) => c.name), [sales.categories])
  const seriesOptions = useMemo(
    () => Array.from(new Set((sales.configProducts ?? []).map((p) => p.series).filter(Boolean) as string[])),
    [sales.configProducts],
  )
  const levelOptions: Record<TagLevelId, string[]> = {
    category: categoryOptions,
    series: seriesOptions,
    scene: SCENE_OPTIONS,
    style: STYLE_OPTIONS,
  }

  const toggle = (level: TagLevelId, value: string) => {
    setSel((prev) => {
      const next = new Set(prev[level])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [level]: next }
    })
  }
  const clearLevel = (level: TagLevelId) => setSel((prev) => ({ ...prev, [level]: new Set() }))
  const clearAll = () => setSel({ category: new Set(), series: new Set(), scene: new Set(), style: new Set() })
  const totalSelected = TAG_LEVELS.reduce((n, l) => n + sel[l.id].size, 0)

  const filtered = entries.filter((e) => {
    if (keyword && !`${e.name}${e.code}`.toLowerCase().includes(keyword.toLowerCase())) return false
    for (const lv of TAG_LEVELS) {
      const chosen = sel[lv.id]
      if (chosen.size === 0) continue
      const got = entryTagsForLevel(lv.id, {
        categoryName: e.categoryName,
        series: e.seriesLabel,
        scenes: e.scenes,
        style: e.style,
      })
      // 已选该级 → 产品在该级必须命中至少一个选中值
      if (![...chosen].some((c) => got.includes(c))) return false
    }
    return true
  })

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <h1>产品目录</h1>
        <p>点开任意产品查看规格、价格、细节图与实景案例</p>
      </header>
      <div className="catalog-filters">
        <div className="catalog-filter-bar">
          <input
            className="catalog-search"
            placeholder="搜索名称 / 编码"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          {totalSelected > 0 && (
            <button className="catalog-clear-all" onClick={clearAll} type="button">
              清空筛选（{totalSelected}）
            </button>
          )}
        </div>
        {TAG_LEVELS.map((lv) => {
          const opts = levelOptions[lv.id]
          const chosen = sel[lv.id]
          return (
            <div className="catalog-chip-row" key={lv.id}>
              <span className="catalog-chip-label">
                {lv.label}
                {chosen.size > 0 && <em className="catalog-chip-count">{chosen.size}</em>}
              </span>
              <div className="catalog-chips">
                <button
                  type="button"
                  className={chosen.size === 0 ? 'catalog-chip on' : 'catalog-chip'}
                  onClick={() => clearLevel(lv.id)}
                >
                  全部
                </button>
                {opts.map((o) => (
                  <button
                    type="button"
                    key={o}
                    className={chosen.has(o) ? 'catalog-chip on' : 'catalog-chip'}
                    onClick={() => toggle(lv.id, o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {lv.presetOnly && <span className="catalog-chip-hint">预设待打标</span>}
            </div>
          )
        })}
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
