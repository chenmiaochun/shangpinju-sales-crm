export interface VehicleSeries { name: string; priceRange: string }

export const VEHICLE_CATALOG: Record<string, VehicleSeries[]> = {
  比亚迪: [{ name: '秦PLUS', priceRange: '8-18万' }, { name: '宋PLUS', priceRange: '13-21万' }, { name: '海豹', priceRange: '15-25万' }, { name: '汉', priceRange: '17-33万' }, { name: '唐', priceRange: '18-27万' }],
  特斯拉: [{ name: 'Model 3', priceRange: '24-34万' }, { name: 'Model Y', priceRange: '25-36万' }, { name: 'Model S', priceRange: '70万以上' }, { name: 'Model X', priceRange: '80万以上' }],
  宝马: [{ name: '3系', priceRange: '30-40万' }, { name: '5系', priceRange: '44-53万' }, { name: 'X3', priceRange: '40-49万' }, { name: 'X5', priceRange: '62-80万' }, { name: 'iX3', priceRange: '40-45万' }],
  奔驰: [{ name: 'C级', priceRange: '33-38万' }, { name: 'E级', priceRange: '45-60万' }, { name: 'GLC', priceRange: '43-54万' }, { name: 'GLE', priceRange: '70-90万' }, { name: 'S级', priceRange: '96万以上' }],
  奥迪: [{ name: 'A4L', priceRange: '32-40万' }, { name: 'A6L', priceRange: '43-66万' }, { name: 'Q5L', priceRange: '40-49万' }, { name: 'Q7', priceRange: '61-81万' }, { name: 'A8L', priceRange: '79万以上' }],
  保时捷: [{ name: 'Macan', priceRange: '58-86万' }, { name: 'Cayenne', priceRange: '95万以上' }, { name: 'Panamera', priceRange: '100万以上' }, { name: 'Taycan', priceRange: '90万以上' }],
  雷克萨斯: [{ name: 'ES', priceRange: '30-49万' }, { name: 'RX', priceRange: '41-62万' }, { name: 'NX', priceRange: '32-55万' }, { name: 'LM', priceRange: '120万以上' }],
  丰田: [{ name: '凯美瑞', priceRange: '17-26万' }, { name: '汉兰达', priceRange: '25-35万' }, { name: '赛那', priceRange: '30-42万' }, { name: '普拉多', priceRange: '45-55万' }, { name: '埃尔法', priceRange: '90万以上' }],
  本田: [{ name: '雅阁', priceRange: '18-26万' }, { name: '皓影', priceRange: '19-27万' }, { name: 'CR-V', priceRange: '19-27万' }, { name: '奥德赛', priceRange: '24-44万' }],
  大众: [{ name: '帕萨特', priceRange: '18-24万' }, { name: '途观L', priceRange: '19-27万' }, { name: '途昂', priceRange: '25-39万' }, { name: '揽境', priceRange: '27-40万' }],
  别克: [{ name: '君越', priceRange: '18-24万' }, { name: '昂科威', priceRange: '20-30万' }, { name: 'GL8', priceRange: '23-47万' }, { name: '世纪', priceRange: '47-69万' }],
  沃尔沃: [{ name: 'S90', priceRange: '41-50万' }, { name: 'XC60', priceRange: '40-48万' }, { name: 'XC90', priceRange: '64-79万' }],
  路虎: [{ name: '揽胜极光', priceRange: '39-47万' }, { name: '发现运动版', priceRange: '39-45万' }, { name: '卫士', priceRange: '69万以上' }, { name: '揽胜', priceRange: '142万以上' }],
  凯迪拉克: [{ name: 'CT5', priceRange: '29-34万' }, { name: 'XT5', priceRange: '35-46万' }, { name: 'XT6', priceRange: '40-55万' }],
  红旗: [{ name: 'H5', priceRange: '16-23万' }, { name: 'H9', priceRange: '31-54万' }, { name: 'HS5', priceRange: '18-25万' }, { name: 'E-HS9', priceRange: '59万以上' }],
  理想: [{ name: 'L6', priceRange: '25-28万' }, { name: 'L7', priceRange: '30-36万' }, { name: 'L8', priceRange: '32-40万' }, { name: 'L9', priceRange: '41-44万' }, { name: 'MEGA', priceRange: '53万以上' }],
  问界: [{ name: 'M5', priceRange: '25-30万' }, { name: 'M7', priceRange: '25-33万' }, { name: 'M8', priceRange: '36-45万' }, { name: 'M9', priceRange: '47-57万' }],
  蔚来: [{ name: 'ET5', priceRange: '30-36万' }, { name: 'ES6', priceRange: '34-40万' }, { name: 'ET7', priceRange: '43-52万' }, { name: 'ES8', priceRange: '50-60万' }],
  小鹏: [{ name: 'MONA M03', priceRange: '12-16万' }, { name: 'P7i', priceRange: '22-29万' }, { name: 'G6', priceRange: '18-25万' }, { name: 'G9', priceRange: '26-36万' }, { name: 'X9', priceRange: '36-42万' }],
  小米汽车: [{ name: 'SU7', priceRange: '22-30万' }, { name: 'SU7 Ultra', priceRange: '53万以上' }, { name: 'YU7', priceRange: '25-33万' }],
  极氪: [{ name: '001', priceRange: '26-33万' }, { name: '007', priceRange: '21-30万' }, { name: '009', priceRange: '44-59万' }, { name: '7X', priceRange: '23-27万' }],
  腾势: [{ name: 'D9', priceRange: '34-47万' }, { name: 'N7', priceRange: '24-33万' }, { name: 'Z9GT', priceRange: '33-42万' }],
  岚图: [{ name: 'FREE', priceRange: '23-27万' }, { name: '梦想家', priceRange: '33-63万' }, { name: '追光', priceRange: '25-39万' }],
  传祺: [{ name: 'M8', priceRange: '18-35万' }, { name: 'GS8', priceRange: '19-25万' }, { name: 'E9', priceRange: '32-41万' }],
  吉利: [{ name: '星越L', priceRange: '14-19万' }, { name: '银河E5', priceRange: '11-15万' }, { name: '银河E8', priceRange: '17-23万' }],
  长安: [{ name: 'CS75 PLUS', priceRange: '12-15万' }, { name: 'UNI-K', priceRange: '15-18万' }, { name: '深蓝S07', priceRange: '15-21万' }],
  坦克: [{ name: '坦克300', priceRange: '20-33万' }, { name: '坦克400', priceRange: '25-29万' }, { name: '坦克500', priceRange: '33-40万' }, { name: '坦克700', priceRange: '43-70万' }],
}

export const VEHICLE_BRANDS = [...Object.keys(VEHICLE_CATALOG), '日产', '福特', '马自达', '现代', '起亚', '斯巴鲁', '捷豹', '林肯', 'Jeep', '其他']

export function vehicleSeriesFor(brand: string) { return VEHICLE_CATALOG[brand] ?? [] }

export function findVehiclePrice(brand: string, series: string) {
  const keyword = series.trim().toLowerCase().replace(/\s+/g, '')
  if (!keyword) return ''
  const match = vehicleSeriesFor(brand).find((item) => {
    const name = item.name.toLowerCase().replace(/\s+/g, '')
    return name === keyword || name.includes(keyword) || keyword.includes(name)
  })
  return match?.priceRange ?? ''
}
