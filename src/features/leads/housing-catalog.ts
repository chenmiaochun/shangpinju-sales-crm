export interface HousingLayout { name: string; area: number }
export interface CommunityItem {
  id: string
  city: string
  name: string
  district: string
  averagePrice: number
  layouts: HousingLayout[]
}

const standardLayouts: HousingLayout[] = [
  { name: '两房两厅', area: 85 },
  { name: '三房两厅', area: 105 },
  { name: '四房两厅', area: 135 },
  { name: '大平层', area: 180 },
  { name: '复式/别墅', area: 240 },
]

function community(id: string, city: string, name: string, district: string, averagePrice: number, areas = [85, 105, 135, 180, 240]): CommunityItem {
  return { id, city, name, district, averagePrice, layouts: standardLayouts.map((layout, index) => ({ ...layout, area: areas[index] })) }
}

export const COMMUNITY_CATALOG: CommunityItem[] = [
  community('jy-baoli', '揭阳', '保利锦城', '榕城区', 12500, [88, 108, 128, 168, 220]),
  community('jy-hengda', '揭阳', '揭阳恒大华府', '榕城区', 10500, [82, 103, 126, 160, 210]),
  community('jy-biyuan', '揭阳', '揭阳碧桂园', '揭东区', 9500, [86, 106, 138, 175, 230]),
  community('jy-rongjiang', '揭阳', '榕江悦府', '榕城区', 13500, [89, 112, 143, 190, 260]),
  community('st-longguang', '汕头', '龙光世纪海岸', '龙湖区', 18000, [88, 110, 140, 185, 250]),
  community('st-huarun', '汕头', '华润海湾中心', '龙湖区', 23500, [92, 118, 148, 195, 270]),
  community('st-zhonghai', '汕头', '中海黄金海岸', '濠江区', 15000, [86, 108, 136, 175, 235]),
  community('st-liantai', '汕头', '联泰香域水岸', '龙湖区', 19000, [90, 115, 145, 188, 255]),
  community('cz-hengda', '潮州', '潮州恒大城', '湘桥区', 9500, [83, 105, 132, 170, 225]),
  community('cz-biyuan', '潮州', '碧桂园城央首府', '湘桥区', 11000, [88, 108, 139, 178, 238]),
  community('cz-hanhui', '潮州', '韩晖名庭', '湘桥区', 10500, [86, 106, 135, 172, 228]),
  community('sz-huaruncheng', '深圳', '华润城润府', '南山区', 110000, [90, 120, 150, 190, 260]),
  community('sz-baoneng', '深圳', '宝能城', '南山区', 98000, [88, 112, 145, 185, 250]),
  community('sz-shenye', '深圳', '深业上城', '福田区', 115000, [85, 110, 140, 180, 245]),
]

export const GENERAL_HOUSING_LAYOUTS = standardLayouts

export function communitiesForCity(city: string) {
  return city ? COMMUNITY_CATALOG.filter((item) => item.city === city) : COMMUNITY_CATALOG
}

export function estimateHouseValue(averagePrice: number, area: number) {
  if (!averagePrice || !area) return ''
  const value = averagePrice * area / 10_000
  return `约 ${Math.round(value * .92)}-${Math.round(value * 1.08)} 万元`
}

export const CITY_REFERENCE_PRICE: Record<string, number> = { 揭阳: 9500, 汕头: 15500, 潮州: 9000, 深圳: 75000, 其他: 10000 }
