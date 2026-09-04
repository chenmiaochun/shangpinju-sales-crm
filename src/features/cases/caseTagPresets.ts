// 案例库预设标签（v1 写死在代码里，不可后台配置；跑通后再考虑迁 app_state）
// 作用：规范案例标签录入，避免同物不同名；前端按分组生成「筛选按钮」。

export interface CaseTagGroup {
  id: string
  label: string
  options: string[]
}

export const CASE_TAG_GROUPS: CaseTagGroup[] = [
  {
    id: 'category',
    label: '大品类',
    options: ['沙发', '床', '餐桌', '餐椅', '茶几', '电视柜', '衣柜', '书柜', '玄关柜', '其他'],
  },
  {
    id: 'series',
    label: '系列',
    options: ['五福系列', '云栖系列', '简逸系列', '原木系列', '其他'],
  },
  {
    id: 'scene',
    label: '场景',
    options: ['客厅', '餐厅', '卧室', '书房', '玄关', '茶室', '定制空间'],
  },
  {
    id: 'community',
    label: '小区',
    // 实际合作小区名由业务补充，此处留空不强制
    options: [],
  },
  {
    id: 'layout',
    label: '户型',
    options: ['两房', '三房', '四房', '复式', '别墅', '小户型', '大平层'],
  },
  {
    id: 'type',
    label: '产品类型',
    options: ['成品', '定制', '软装', '全案'],
  },
]

// 全部预设标签（用于校验 / 去重 / 自动补全）
export const ALL_CASE_TAG_PRESETS: string[] = CASE_TAG_GROUPS.flatMap((group) => group.options)
