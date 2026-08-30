const path = require('path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '../..');
const db = new DatabaseSync(path.join(ROOT, 'server/data/sales.sqlite'), { readOnly: true });
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db.close();

const cs = state.customers ?? [];
const imported = cs.filter(c => String(c.leadId || '').startsWith('FS-'));
const legacy = cs.filter(c => !String(c.leadId || '').startsWith('FS-'));

// 账号名 → username
const ACCOUNT_NAME = {
  'account-998d092561fc0af0': 'spj004',
  'account-82e308c77274f3b0': 'spj003',
  'account-2a9a1b28cb6d81ad': 'spj006',
  'account-e7193f3620092212': 'spj009',
  'account-a02995c5173ce77a': 'spj007',
  'account-544d3656f066adeb': 'spj008',
  'account-3ea55b5ad49057be': 'admin（店长·暂挂）',
};

const wb = XLSX.utils.book_new();

// Sheet1 导入总览
const stageCnt = {}, intentCnt = {}, monthCnt = {};
for (const c of imported) {
  stageCnt[c.stage] = (stageCnt[c.stage] || 0) + 1;
  intentCnt[c.intent] = (intentCnt[c.intent] || 0) + 1;
  const m = String(c.createdAt).slice(0, 7);
  monthCnt[m] = (monthCnt[m] || 0) + 1;
}
const overview = [
  { 项目: '导入时间', 值: new Date().toISOString().slice(0, 19).replace('T', ' ') },
  { 项目: '数据源', 值: '飞书 Base「尚品居客户登记表（2026年）」· 客户进店登记' },
  { 项目: '飞书导入客户数', 值: imported.length },
  { 项目: '原有客户数（未改动）', 值: legacy.length + '（' + legacy.map(c => c.name).join('、') + '）' },
  { 项目: '客户总数', 值: cs.length },
  { 项目: '新增跟进记录', 值: (state.followUps ?? []).filter(f => String(f.id).startsWith('fu-fs-')).length },
  { 项目: '', 值: '' },
  { 项目: 'phone 字段存的是什么', 值: '微信名（老板 2026-08-29 指定，非真实手机号）' },
  { 项目: '已填微信名', 值: imported.filter(c => c.phone).length },
  { 项目: '待补联系方式', 值: imported.filter(c => !c.phone).length + '（占位符已剔除 + 无微信名）' },
  { 项目: '已按微信名合并去重', 值: '50 组重复（118 条）已合并为 50 个客户，重复组归零' },
  { 项目: '已删除无账号负责人客户', 值: '13 条（陈妙纯 12 + 吴漫东 1）' },
  { 项目: '姓名待补录', 值: imported.filter(c => String(c.name).startsWith('（待补姓名')).length },
  { 项目: '负责人待确认（暂挂店长）', 值: imported.filter(c => c.salespersonId === 'account-3ea55b5ad49057be').length },
  { 项目: '', 值: '' },
  { 项目: '— 跟进阶段分布 —', 值: '' },
  ...Object.entries(stageCnt).map(([k, v]) => ({ 项目: k, 值: v })),
  { 项目: '', 值: '' },
  { 项目: '— 意向等级分布 —', 值: '' },
  ...Object.entries(intentCnt).map(([k, v]) => ({ 项目: k, 值: v })),
  { 项目: '', 值: '' },
  { 项目: '— 到店月份分布 —', 值: '' },
  ...Object.entries(monthCnt).sort().map(([k, v]) => ({ 项目: k, 值: v })),
];
const ws1 = XLSX.utils.json_to_sheet(overview);
ws1['!cols'] = [{ wch: 28 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, ws1, '导入总览');

// Sheet2 负责人分配
const byOwner = new Map();
for (const c of imported) {
  const k = c.salesperson;
  if (!byOwner.has(k)) byOwner.set(k, { name: k, id: c.salespersonId, n: 0, floating: 0 });
  const o = byOwner.get(k);
  o.n++;
  if (c.salespersonId === 'account-3ea55b5ad49057be') o.floating++;
}
const ownerRows = [...byOwner.values()].sort((a, b) => b.n - a.n).map(o => ({
  负责人: o.name,
  登录账号: ACCOUNT_NAME[o.id] || o.id,
  客户数: o.n,
  其中暂挂店长: o.floating,
  状态: o.floating > 0 ? '需确认' : '已就位'
}));
const ws2 = XLSX.utils.json_to_sheet(ownerRows);
ws2['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
XLSX.utils.book_append_sheet(wb, ws2, '负责人分配');

// Sheet3 手机号补录清单（按负责人分组，可直接分发）
const phoneRows = imported
  .filter(c => !c.phone)
  .map(c => ({
    负责人: c.salesperson,
    客户编号: String(c.leadId).replace('FS-', ''),
    姓名: c.name,
    手机号: '',
    待补原因: String(c.name).startsWith('（待补姓名') ? '姓名也缺' : '飞书未加微信',
    城市: c.cityArea || '',
    区县: c.communityDistrict || '',
    小区: c.communityName || '',
    到店日期: String(c.createdAt).slice(0, 10),
    跟进阶段: c.stage,
    意向: c.intent
  }))
  .sort((a, b) => a.负责人.localeCompare(b.负责人, 'zh') || a.到店日期.localeCompare(b.到店日期));
const ws3 = XLSX.utils.json_to_sheet(phoneRows);
ws3['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 8 }];
XLSX.utils.book_append_sheet(wb, ws3, '联系方式待补(52条)');

// Sheet4 待补姓名
const nameRows = imported.filter(c => String(c.name).startsWith('（待补姓名')).map(c => ({
  客户编号: String(c.leadId).replace('FS-', ''),
  当前显示: c.name,
  负责人: c.salesperson,
  城市: c.cityArea || '',
  区县: c.communityDistrict || '',
  小区: c.communityName || '',
  到店日期: String(c.createdAt).slice(0, 10),
  姓名: ''
}));
const ws4 = XLSX.utils.json_to_sheet(nameRows);
ws4['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws4, '待补姓名');

// Sheet5 负责人待确认
const floatRows = imported.filter(c => c.salespersonId === 'account-3ea55b5ad49057be').map(c => ({
  客户编号: String(c.leadId).replace('FS-', ''),
  姓名: c.name,
  飞书登记负责人: c.salesperson,
  现状: '暂挂店长（该负责人在销售软件无账号）',
  到店日期: String(c.createdAt).slice(0, 10),
  城市: c.cityArea || ''
}));
const ws5 = XLSX.utils.json_to_sheet(floatRows);
ws5['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 36 }, { wch: 12 }, { wch: 10 }];
XLSX.utils.book_append_sheet(wb, ws5, '负责人待确认');

const out = path.join(__dirname, '飞书意向客户_导入报告.xlsx');
XLSX.writeFile(wb, out);
console.log('已生成:', out);
console.log('客户总数:', cs.length, '| 飞书导入:', imported.length);
console.log('手机号待补:', phoneRows.length, '| 待补姓名:', nameRows.length, '| 负责人待确认:', floatRows.length);
