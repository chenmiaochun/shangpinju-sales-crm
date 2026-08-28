// 产品主数据页共享工具
import type { ProductComponent, ProductSeries } from "../../types";

// 内置「公共/其他」系列：虚拟系列，不写库，每个大类自动拥有，不可删除。
// 历史主件 seriesId 为空 = 归入公共/其他。
export const PUBLIC_SERIES_ID = "series-public";
export const PUBLIC_SERIES_NAME = "公共/其他";

export function publicSeries(categoryId: string): ProductSeries {
  return {
    id: PUBLIC_SERIES_ID,
    categoryId,
    name: PUBLIC_SERIES_NAME,
    sort: -1,
    builtin: true,
  };
}

// 某大类下的完整系列列表 = [公共/其他, ...真实系列]
export function seriesListOf(
  categoryId: string,
  series: ProductSeries[],
): ProductSeries[] {
  return [
    publicSeries(categoryId),
    ...(series ?? [])
      .filter((s) => s.categoryId === categoryId)
      .sort(bySort),
  ];
}

// 主件归属系列 id：空 seriesId 归一为公共/其他
export function seriesIdOf(comp: ProductComponent): string {
  return comp.seriesId || PUBLIC_SERIES_ID;
}

// 系列 id → 名称（公共/其他按内置名，找不到回退「未分组」）
export function seriesNameOf(
  seriesId: string | undefined,
  series: ProductSeries[],
): string {
  if (!seriesId || seriesId === PUBLIC_SERIES_ID) return PUBLIC_SERIES_NAME;
  return series.find((s) => s.id === seriesId)?.name ?? "未分组";
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDecimal(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(value: number): string {
  return `¥${formatDecimal(value)}`;
}

export function formatPriceRange(range: {
  min: number;
  max: number;
  exact: boolean;
}): string {
  if (range.min === range.max) return formatCurrency(range.min);
  return `${formatCurrency(range.min)} ~ ${formatCurrency(range.max)}`;
}

export function bySort<T extends { sort: number }>(a: T, b: T): number {
  return a.sort - b.sort;
}
