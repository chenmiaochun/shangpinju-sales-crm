import type { ConfigProduct, MediaFile, ProductMedia, SkuUnit } from '../types'
import { availableCount, configProductAvailability, configProductPrice, configProductPriceRange } from './product-config'

export interface GroupVariant {
  id: string
  specLabel: string
  price: number
  stock: number
  product: ConfigProduct
}

export interface GroupedProduct {
  groupId: string
  representativeId: string
  name: string // 基础名（去尺寸）
  fullName: string // 代表产品原名（含尺寸）
  code: string
  categoryId?: string
  series?: string
  materialDescription?: string
  applicableSpace?: string[]
  description?: string
  media: ProductMedia
  variants: GroupVariant[]
  priceMin: number
  priceMax: number
  priceExact: boolean
}

const baseName = (name: string) => (name || '').split('·')[0].trim() || name || '未命名'

function representativeOf(members: ConfigProduct[]): ConfigProduct {
  return [...members].sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (so !== 0) return so
    return (a.code || '').localeCompare(b.code || '')
  })[0]
}

export function groupProducts(products: ConfigProduct[], skuUnits: SkuUnit[]): GroupedProduct[] {
  const byGroup = new Map<string, ConfigProduct[]>()
  for (const p of products) {
    const g = p.groupId || p.id
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g)!.push(p)
  }
  const result: GroupedProduct[] = []
  for (const [groupId, members] of byGroup) {
    const rep = representativeOf(members)
    const variants: GroupVariant[] = members
      .map((m) => {
        const price = configProductPrice(m, skuUnits)
        const avail = configProductAvailability(m, skuUnits)
        return {
          id: m.id,
          specLabel: m.specLabel || baseName(m.name),
          price,
          stock: avail.stock,
          product: m,
        }
      })
      .sort((a, b) => a.price - b.price)
    const prices = variants.map((v) => v.price)
    const priceMin = prices.length ? Math.min(...prices) : 0
    const priceMax = prices.length ? Math.max(...prices) : 0
    result.push({
      groupId,
      representativeId: rep.id,
      name: baseName(rep.name),
      fullName: rep.name,
      code: rep.code,
      categoryId: rep.categoryId,
      series: rep.series,
      materialDescription: rep.materialDescription,
      applicableSpace: rep.applicableSpace,
      description: rep.description,
      media: rep.media || { images: [] },
      variants,
      priceMin,
      priceMax,
      priceExact: variants.length <= 1,
    })
  }
  return result.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
}

export function firstMainImage(media?: ProductMedia): string | undefined {
  return media?.whiteBgImages?.[0]?.url ?? media?.images?.[0]?.url
}

export function mediaCounts(media?: ProductMedia): { white: number; scene: number; real: number } {
  return {
    white: media?.whiteBgImages?.length ?? 0,
    scene: media?.sceneImages?.length ?? 0,
    real: media?.realShotImages?.length ?? 0,
  }
}

export type { MediaFile, ProductMedia }
