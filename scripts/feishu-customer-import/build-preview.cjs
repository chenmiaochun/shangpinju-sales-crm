const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const OUT_DIR = __dirname;
const rows = fs.readFileSync(path.join(OUT_DIR, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const has = v => v != null && String(v).trim() !== '';
const one = v => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
const txt = v => (v == null ? '' : String(v).trim());
const day = v => (v ? String(v).slice(0, 10) : '');

// ---- 映射规则 ----
function mapStage(r) {
  const st = one(r['当前状态']);
  const deal = one(r['成交信息']);
  if (st === '已成交') return { stage: '已成交', rule: '当前状态' };
  if (st === '已流失') return { stage: '已流失', rule: '当前状态' };
  if (st === '复访到店') return { stage: '到店', rule: '当前状态→到店' };
  if (st === '持续跟进') return { stage: '需求确认', rule: '当前状态→需求确认' };
  if (st === '首次到店') return { stage: '到店', rule: '当前状态→到店' };
  if (!has(st)) {
    if (deal === '已成交') return { stage: '已成交', rule: '状态空·成交信息兜底' };
    if (deal === '已流失') return { stage: '已流失', rule: '状态空·成交信息兜底' };
    if (deal === '未成交') return { stage: '到店', rule: '状态空·成交信息兜底' };
    return { stage: '到店', rule: '状态空·默认到店' };
  }
  return { stage: '到店', rule: '未知状态兜底' };
}

function mapIntent(r) {
  const n = r['购买意向'];
  if (n == null || n === '') return { intent: '中', rule: '空→默认中' };
  const v = Number(n);
  if (v >= 4) return { intent: '高', rule: `${v}→高` };
  if (v === 3) return { intent: '中', rule: '3→中' };
  if (v === 2) return { intent: '中', rule: '2→中' };
  return { intent: '低', rule: `${v}→低` };
}

function mapSalesperson(r) {
  const recv = one(r['接待人员']);
  if (has(recv)) return { sp: txt(recv), rule: '接待人员' };
  const main = one(r['主谈人员']);
  if (has(main) && main !== '无') return { sp: txt(main), rule: '接待空→主谈人员' };
  return { sp: '未分配', rule: '无接待无主谈' };
}

const problems = [];
const preview = rows.map((r, i) => {
  const p = [];
  const nameRaw = txt(r['客户姓名']);
  const wechat = txt(r['客户微信名']);
  let name = nameRaw;
  if (!has(nameRaw)) {
    if (has(wechat)) { name = wechat; p.push('无姓名·用微信名'); }
    else { name = `（待补-${txt(r['客户编号']) || i}）`; p.push('⚠姓名微信名全空'); }
  }
  if (has(nameRaw) && nameRaw.length === 1) p.push('姓名仅1字');
  if (!has(r['手机号'])) p.push('⚠手机号待补');
  if (!r['到店日期']) p.push('⚠到店日期空');

  const st = mapStage(r);
  const it = mapIntent(r);
  const sp = mapSalesperson(r);
  if (st.rule.includes('兜底') || st.rule.includes('未知')) p.push('状态待确认');
  if (it.rule.includes('默认')) p.push('意向未填');

  if (p.length) {
    problems.push({
      序号: i + 1, 客户编号: txt(r['客户编号']), 姓名: nameRaw || '(空)',
      微信名: wechat || '(空)', 问题: p.join(' / ')
    });
  }

  return {
    '序号': i + 1,
    '客户编号': txt(r['客户编号']),
    '飞书_姓名': nameRaw,
    '飞书_微信名': wechat,
    '→name(转换后)': name,
    '手机号(待飞书补录)': txt(r['手机号']),
    '所属城市': txt(one(r['所属城市'])),
    '所属区县': txt(one(r['所属区县'])),
    '城市小区名': txt(r['城市小区名']),
    '到店日期': day(r['到店日期']),
    '到店时段': txt(one(r['到店时段'])),
    '飞书_认知途径': txt(one(r['认知途径'])),
    '→source': txt(one(r['认知途径'])) || '未标注',
    '飞书_接待人员': txt(one(r['接待人员'])),
    '飞书_主谈人员': txt(one(r['主谈人员'])),
    '→salesperson': sp.sp,
    '飞书_当前状态': txt(one(r['当前状态'])),
    '飞书_成交信息': txt(one(r['成交信息'])),
    '→stage': st.stage,
    '飞书_购买意向': r['购买意向'] == null ? '' : r['购买意向'],
    '→intent': it.intent,
    '预算范围': txt(one(r['预算范围'])),
    '装修进度': txt(one(r['装修进度'])) || '未填写',
    '核心需求→products': arr(r['核心需求']).join('、'),
    '车品牌': txt(one(r['车品牌'])),
    '车牌信息': txt(r['车牌信息']),
    '下次跟进时间': day(r['下次跟进时间']),
    '跟进记录': txt(r['跟进记录']),
    '备注': txt(r['备注']),
    '数据问题': p.join(' / ')
  };
});

// ---- 映射规则说明 ----
const rules = [
  { 销售软件字段: 'name', 飞书来源: '客户姓名 → 微信名 → 兜底', 规则: '姓名空则用微信名；两者都空标记待补' },
  { 销售软件字段: 'phone', 飞书来源: '手机号（新建·待补录）', 规则: '必填，用于查重；补录后方可导入' },
  { 销售软件字段: 'source', 飞书来源: '认知途径', 规则: '直接取，空则填「未标注」' },
  { 销售软件字段: 'salesperson', 飞书来源: '接待人员 → 主谈人员', 规则: '接待优先；主谈为「无」则视为未分配' },
  { 销售软件字段: 'stage', 飞书来源: '当前状态 → 成交信息兜底', 规则: '首次/复访到店→到店；持续跟进→需求确认；已成交→已成交；已流失→已流失；空则看成交信息' },
  { 销售软件字段: 'intent', 飞书来源: '购买意向(1-4)', 规则: '4→高；3、2→中；1→低；空→中' },
  { 销售软件字段: 'expectedAmount', 飞书来源: '（无对应）', 规则: '填 0，后续按报价更新' },
  { 销售软件字段: 'products', 飞书来源: '核心需求（多选）', 规则: '直接映射为数组' },
  { 销售软件字段: 'budget', 飞书来源: '预算范围', 规则: '直接取，空则留空串' },
  { 销售软件字段: 'renovationProgress', 飞书来源: '装修进度', 规则: '直接取，空则填「未填写」' },
  { 销售软件字段: 'cityArea', 飞书来源: '所属城市', 规则: '直接取' },
  { 销售软件字段: 'communityDistrict', 飞书来源: '所属区县', 规则: '直接取' },
  { 销售软件字段: 'communityName', 飞书来源: '城市小区名', 规则: '直接取' },
  { 销售软件字段: 'vehicleBrand', 飞书来源: '车品牌', 规则: '直接取' },
  { 销售软件字段: 'licensePlate', 飞书来源: '车牌信息', 规则: '直接取' },
  { 销售软件字段: 'visitPeriod', 飞书来源: '到店时段', 规则: '直接取' },
  { 销售软件字段: 'nextFollowUpAt', 飞书来源: '下次跟进时间', 规则: '取日期' },
  { 销售软件字段: 'notes', 飞书来源: '备注', 规则: '直接取' },
  { 销售软件字段: 'lastContactAt', 飞书来源: '到店日期', 规则: '取日期' },
  { 销售软件字段: 'createdAt', 飞书来源: '到店日期', 规则: '取日期' },
  { 销售软件字段: 'FollowUp(跟进记录)', 飞书来源: '跟进记录', 规则: '非空则生成 1 条跟进记录，渠道「到店」' }
];

const wb = XLSX.utils.book_new();

const ws1 = XLSX.utils.json_to_sheet(preview);
ws1['!cols'] = Object.keys(preview[0]).map(k =>
  ({ wch: k.startsWith('飞书_') || k.startsWith('→') ? 16 : k.length > 6 ? 18 : 12 }));
XLSX.utils.book_append_sheet(wb, ws1, '对照预览');

const ws2 = XLSX.utils.json_to_sheet(rules);
ws2['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, ws2, '映射规则');

const ws3 = XLSX.utils.json_to_sheet(problems);
ws3['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 42 }];
XLSX.utils.book_append_sheet(wb, ws3, '待处理清单');

const outFile = path.join(OUT_DIR, '飞书意向客户_对照预览.xlsx');
XLSX.writeFile(wb, outFile);

console.log('已生成:', outFile);
console.log('对照预览行数:', preview.length);
console.log('待处理问题行数:', problems.length);
const cnt = {};
for (const p of problems) for (const t of p.问题.split(' / ')) cnt[t] = (cnt[t] || 0) + 1;
console.log('\n问题分类统计:');
for (const [k, v] of Object.entries(cnt).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
