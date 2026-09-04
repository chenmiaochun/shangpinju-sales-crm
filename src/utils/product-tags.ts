// 产品四级标签体系（品类 → 系列 → 场景 → 风格/户型）
//
// - 品类(category)：来自 state.categories（结构化，已实现）
// - 系列(series)：来自产品 series 字段（已实现，18 个值）
// - 场景(scene)：来自产品 applicableSpace[]（预设枚举，待打标后生效）
// - 风格/户型(style)：来自产品 style 字段（预设枚举，待打标后生效）
//
// 前两级数据已齐，可直接多选筛选；后两级预设已就绪，产品打标后即自动可用。

/** 第③级 场景 预设枚举 */
export const SCENE_OPTIONS = ['客厅', '餐厅', '卧室', '书房', '茶室', '玄关', '定制空间']

/** 第④级 风格/户型 预设枚举 */
export const STYLE_OPTIONS = ['现代简约', '新中式', '北欧', '轻奢', '小户型', '大户型', '别墅', '复式']

export type TagLevelId = 'category' | 'series' | 'scene' | 'style'

export interface TagLevel {
  id: TagLevelId
  label: string
  /** 该级是否为预设枚举（数据尚未打标，选择后当前可能无命中） */
  presetOnly: boolean
}

/** 四级定义（顺序即展示顺序） */
export const TAG_LEVELS: TagLevel[] = [
  { id: 'category', label: '品类', presetOnly: false },
  { id: 'series', label: '系列', presetOnly: false },
  { id: 'scene', label: '场景', presetOnly: true },
  { id: 'style', label: '风格/户型', presetOnly: true },
]

/** 取某产品在某一级上的取值集合（用于多选命中判断） */
export function entryTagsForLevel(
  level: TagLevelId,
  values: { categoryName?: string; series?: string; scenes?: string[]; style?: string },
): string[] {
  switch (level) {
    case 'category':
      return values.categoryName ? [values.categoryName] : []
    case 'series':
      return values.series ? [values.series] : []
    case 'scene':
      return values.scenes ?? []
    case 'style':
      return values.style ? [values.style] : []
  }
}
