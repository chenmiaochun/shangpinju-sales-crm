export const furnitureTaxonomy = {
  成品家具: {
    沙发: ['单人沙发', '双人沙发', '三人沙发', '组合沙发', '功能沙发', '休闲椅'],
    桌几: ['餐桌', '茶几', '边几', '书桌', '梳妆台', '玄关桌'],
    柜类: ['电视柜', '餐边柜', '书柜', '衣柜', '斗柜', '鞋柜', '床头柜', '酒柜'],
    床类: ['单人床', '双人床', '儿童床', '高低床', '榻榻米'],
    椅凳: ['餐椅', '书椅', '吧椅', '换鞋凳', '床尾凳'],
    架类: ['衣帽架', '书架', '置物架', '花架'],
  },
  定制家具: {
    全屋定制: ['客厅定制', '餐厅定制', '卧室定制', '书房定制', '儿童房定制'],
    柜体定制: ['衣柜定制', '橱柜定制', '电视柜定制', '餐边柜定制', '书柜定制', '玄关柜定制'],
    木作定制: ['护墙板', '木门', '楼梯', '隐形门', '格栅背景'],
  },
  睡眠用品: {
    床垫: ['弹簧床垫', '乳胶床垫', '棕垫', '记忆棉床垫', '儿童床垫', '智能床垫'],
    床品: ['床笠', '床单', '被套', '枕套', '被芯', '枕芯', '床盖'],
    睡眠配套: ['床架', '床板', '排骨架', '床垫保护垫'],
  },
  软装饰品: {
    布艺: ['窗帘', '地毯', '抱枕', '桌旗', '盖毯'],
    灯饰: ['吊灯', '台灯', '落地灯', '壁灯'],
    饰品: ['摆件', '花器', '装饰画', '镜子', '时钟', '香薰'],
  },
  配套服务: {
    配送安装: ['送货费', '安装费', '上楼费', '吊装费'],
    设计服务: ['量尺服务', '空间设计', '深化设计'],
    售后服务: ['维修费', '补件费', '翻新费'],
  },
} as const

export type CategoryLevel1 = keyof typeof furnitureTaxonomy
export const categoryLevel1Options = Object.keys(furnitureTaxonomy) as CategoryLevel1[]
export const categoryLevel2Options = (level1: string) => level1 in furnitureTaxonomy ? Object.keys(furnitureTaxonomy[level1 as CategoryLevel1]) : []
export const categoryLevel3Options = (level1: string, level2: string): string[] => {
  const second = level1 in furnitureTaxonomy ? furnitureTaxonomy[level1 as CategoryLevel1] : undefined
  return second && level2 in second ? [...second[level2 as keyof typeof second]] as string[] : []
}
export const isValidCategoryPath = (level1: string, level2: string, level3: string) => categoryLevel3Options(level1, level2).includes(level3)

const level2Aliases: Record<string, string> = {
  台: '桌几', 桌: '桌几', 椅: '椅凳', 凳: '椅凳', 柜: '柜类', 床: '床类', 架子: '架类', 架: '架类',
}
const level3Aliases: Record<string, string> = {
  三人位: '三人沙发', 餐台: '餐桌', 衣架子: '衣帽架', 衣架: '衣帽架', 大床: '双人床',
}

export function normalizeCategoryPath(level1: string, level2: string, level3: string) {
  let normalizedLevel1 = level1.trim()
  let normalizedLevel2 = (level2Aliases[level2.trim()] ?? level2).trim()
  let normalizedLevel3 = (level3Aliases[level3.trim()] ?? level3).trim()

  if (normalizedLevel2 === '床垫' || normalizedLevel2 === '床品' || normalizedLevel2 === '睡眠配套') normalizedLevel1 = '睡眠用品'
  if (normalizedLevel2 === '灯饰' || normalizedLevel2 === '饰品' || normalizedLevel2 === '布艺') normalizedLevel1 = '软装饰品'
  if (normalizedLevel2 === '床类' && /(?:大床|双人床)/.test(normalizedLevel3)) normalizedLevel3 = '双人床'

  return { level1: normalizedLevel1, level2: normalizedLevel2, level3: normalizedLevel3 }
}
