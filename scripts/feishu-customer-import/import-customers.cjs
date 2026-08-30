// 飞书意向客户 → 销售软件 customers 导入
// 用法: node scripts/feishu-customer-import/import-customers.cjs          (干跑)
//       node scripts/feishu-customer-import/import-customers.cjs --apply  (实际写入)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const APPLY = process.argv.includes('--apply');
const API = 'http://localhost:3001';
const HDRS = { 'content-type': 'application/json', origin: 'http://localhost:5173' };
const ADMIN = {
  username: process.env.IMPORT_USER || 'admin',
  password: process.env.IMPORT_PASS || 'AcceptTest-2026',
};

const IMPORT_BOT_ID = 'account-import-1787989406355';

// 飞书接待人员 → 销售软件账号
const OWNER_MAP = {
  '陈婉珊': 'account-998d092561fc0af0',
  '郭予旭': 'account-82e308c77274f3b0',
  '林泽鹏': 'account-2a9a1b28cb6d81ad',
  '吴思雅': 'account-e7193f3620092212',
  '吴凯达': 'account-a02995c5173ce77a',
  '王文林': 'account-544d3656f066adeb',
};
const FALLBACK_OWNER_ID = 'account-3ea55b5ad49057be'; // 店长：无账号者暂挂
const FALLBACK_OWNER_NAME = '店长';

const rows = fs.readFileSync(path.join(__dirname, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const has = v => v != null && String(v).trim() !== '';
const one = v => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
const txt = v => (v == null ? '' : String(v).trim());
const isoDay = v => (v ? String(v).slice(0, 10) : '');
const isoFull = v => (v ? new Date(v).toISOString() : '');
// 注意：不要对 Date 对象直接用 isoDay，String(new Date()) 会得到 "Sat Aug 29 ..." 而非 ISO 串
const todayStr = () => new Date().toISOString().slice(0, 10);

function mapStage(r) {
  const st = one(r['当前状态']);
  const deal = one(r['成交信息']);
  if (st === '已成交') return '已成交';
  if (st === '已流失') return '已流失';
  if (st === '持续跟进') return '需求确认';
  if (st === '复访到店') return '到店';
  if (st === '首次到店') return '到店';
  if (deal === '已成交') return '已成交';
  if (deal === '已流失') return '已流失';
  return '到店';
}

function mapIntent(r) {
  const n = r['购买意向'];
  if (n == null || n === '') return '中';
  const v = Number(n);
  if (v >= 4) return '高';
  if (v >= 2) return '中';
  return '低';
}

function mapOwner(r) {
  const recv = txt(one(r['接待人员']));
  if (has(recv)) {
    const id = OWNER_MAP[recv];
    if (id) return { name: recv, id, floating: false };
    return { name: recv, id: FALLBACK_OWNER_ID, floating: true, reason: `无账号·暂挂${FALLBACK_OWNER_NAME}` };
  }
  const main = txt(one(r['主谈人员']));
  if (has(main) && main !== '无') {
    const id = OWNER_MAP[main];
    if (id) return { name: main, id, floating: false, reason: '接待空·用主谈' };
    return { name: main, id: FALLBACK_OWNER_ID, floating: true, reason: `无账号·暂挂${FALLBACK_OWNER_NAME}` };
  }
  return { name: FALLBACK_OWNER_NAME, id: FALLBACK_OWNER_ID, floating: true, reason: '无接待无主谈·待分配' };
}

const stats = { total: rows.length, dup: 0, floating: 0, noName: 0, followUps: 0 };
const floatingList = [];
const customers = [];
const followUps = [];
const seen = new Set();

for (const r of rows) {
  const rid = r.record_id;
  const no = txt(r['客户编号']);
  const leadId = `FS-${no || rid}`;
  if (seen.has(leadId)) { stats.dup++; continue; }
  seen.add(leadId);

  const nameRaw = txt(r['客户姓名']);
  const wechat = txt(r['客户微信名']);
  let name = nameRaw;
  if (!has(nameRaw)) {
    if (has(wechat)) name = wechat;
    else { name = `（待补姓名-${no || rid}）`; stats.noName++; }
  }

  const owner = mapOwner(r);
  if (owner.floating) {
    stats.floating++;
    floatingList.push({ 编号: no, 姓名: name, 原负责人: owner.name, 处理: owner.reason });
  }

  const id = `cust-fs-${rid}`;
  const arrive = r['到店日期'];

  // 到店日期为空时，用飞书「月份」→ 编号末两位 → 今天，逐级回退
  let createdAtFallback = todayStr();
  const mRaw = one(r['月份']);
  const mmFromField = mRaw ? String(mRaw).replace('月', '').trim().padStart(2, '0') : '';
  if (/^\d{1,2}$/.test(mmFromField)) createdAtFallback = `2026-${mmFromField.padStart(2, '0')}-01`;
  else if (/^\d{5}$/.test(no)) createdAtFallback = `2026-${no.slice(-2)}-01`;

  customers.push({
    id,
    leadId,
    name,
    phone: txt(r['手机号']),
    source: txt(one(r['认知途径'])) || '未标注',
    salesperson: owner.name,
    salespersonId: owner.id,
    createdBy: '飞书导入',
    createdById: IMPORT_BOT_ID,
    stage: mapStage(r),
    intent: mapIntent(r),
    expectedAmount: 0,
    products: arr(r['核心需求']),
    style: '',
    budget: txt(one(r['预算范围'])),
    renovationProgress: txt(one(r['装修进度'])) || '未填写',
    concerns: [],
    cityArea: txt(one(r['所属城市'])),
    communityDistrict: txt(one(r['所属区县'])),
    communityName: txt(r['城市小区名']),
    visitPeriod: txt(one(r['到店时段'])),
    vehicleBrand: txt(one(r['车品牌'])),
    licensePlate: txt(r['车牌信息']),
    notes: txt(r['备注']),
    remarkImages: [],
    businessFiles: [],
    lastContactAt: isoFull(arrive) || `${createdAtFallback}T00:00:00.000Z`,
    nextFollowUpAt: isoDay(r['下次跟进时间']) || undefined,
    createdAt: isoDay(arrive) || createdAtFallback,
    updatedAt: new Date().toISOString(),
  });

  const fu = txt(r['跟进记录']);
  if (fu) {
    followUps.push({
      id: `fu-fs-${rid}`,
      customerId: id,
      at: isoFull(arrive),
      channel: '到店',
      content: fu,
      result: '',
      nextAction: '',
      nextAt: isoDay(r['下次跟进时间']) || undefined,
      salesperson: owner.name,
      salespersonId: owner.id,
    });
    stats.followUps++;
  }
}

console.log('== 转换统计 ==');
console.log(JSON.stringify(stats, null, 1));
if (floatingList.length) {
  console.log('\n== 负责人待确认（暂挂店长）==');
  const byOwner = new Map();
  for (const f of floatingList) {
    const k = `${f.原负责人} → ${f.处理}`;
    byOwner.set(k, (byOwner.get(k) || 0) + 1);
  }
  for (const [k, v] of byOwner) console.log(`  ${k}: ${v} 条`);
}

console.log('\n== 负责人分配结果 ==');
const bySp = new Map();
for (const c of customers) bySp.set(c.salesperson, (bySp.get(c.salesperson) || 0) + 1);
for (const [k, v] of [...bySp].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

console.log('\n== 前 2 条样例 ==');
console.log(JSON.stringify(customers.slice(0, 2), null, 1));

if (!APPLY) { console.log('\n(干跑结束，未写入。加 --apply 执行导入)'); process.exit(0); }

(async () => {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: HDRS, body: JSON.stringify(ADMIN),
  });
  if (!loginRes.ok) throw new Error('登录失败: ' + loginRes.status + ' ' + await loginRes.text());
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const backup = await (await fetch(`${API}/api/backup`, { headers: { ...HDRS, cookie } })).json();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const backupPath = path.join(ROOT, 'backups', `sales-backup-${stamp}-before-feishu-customers.json`);
  fs.mkdirSync(path.join(ROOT, 'backups'), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backup));
  console.log('\n导入前备份:', backupPath, fs.statSync(backupPath).size, 'bytes');

  const remote = (await (await fetch(`${API}/api/state`, { headers: { ...HDRS, cookie } })).json());
  const state = remote.value;

  const existingLead = new Set((state.customers ?? []).map(c => c.leadId).filter(Boolean));
  const existingId = new Set((state.customers ?? []).map(c => c.id));
  const newCustomers = customers.filter(c => !existingLead.has(c.leadId) && !existingId.has(c.id));
  const newFollowUps = followUps.filter(f => !existingId.has(f.customerId + '')
    && newCustomers.some(c => c.id === f.customerId));

  console.log(`现有客户 ${(state.customers ?? []).length} → 新增 ${newCustomers.length}（跳过重复 ${customers.length - newCustomers.length}）`);
  console.log(`新增跟进记录 ${newFollowUps.length}`);

  const merged = {
    ...state,
    customers: [...newCustomers, ...(state.customers ?? [])],
    followUps: [...newFollowUps, ...(state.followUps ?? [])],
  };

  const putRes = await fetch(`${API}/api/state`, {
    method: 'PUT', headers: { ...HDRS, cookie }, body: JSON.stringify(merged),
  });
  if (!putRes.ok) throw new Error('PUT 失败: ' + putRes.status + ' ' + await putRes.text());
  console.log('PUT ok');

  const after = (await (await fetch(`${API}/api/state`, { headers: { ...HDRS, cookie } })).json()).value;
  console.log('== 导入后 ==');
  console.log('客户总数:', after.customers.length, '| 跟进记录:', after.followUps.length);
  const byAfter = new Map();
  for (const c of after.customers) byAfter.set(c.salesperson, (byAfter.get(c.salesperson) || 0) + 1);
  console.log('负责人分布:');
  for (const [k, v] of [...byAfter].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
})().catch(e => { console.error(e); process.exit(1); });
