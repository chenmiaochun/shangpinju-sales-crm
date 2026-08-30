const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });
const st = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db.close();

const show = (name, arr, keys) => {
  console.log(`\n=== ${name} (${(arr ?? []).length}) ===`);
  for (const x of (arr ?? []).slice(0, 6)) {
    const o = {};
    for (const k of keys) o[k] = x[k];
    console.log('  ' + JSON.stringify(o));
  }
};

show('warehouses 仓库', st.warehouses, ['id', 'name', 'type']);
show('designTasks 设计协作', st.designTasks, ['id', 'customerName', 'designer', 'designerId', 'salesperson', 'status', 'priority', 'type']);
show('supplyDemands 采购需求', st.supplyDemands, ['id', 'productName', 'status', 'requestedBy']);
show('warehouseStocks 库存', st.warehouseStocks, ['id', 'warehouseId', 'productName', 'quantity']);

console.log('\n=== 客户跟进与待办相关字段 ===');
const c = (st.customers ?? [])[0];
if (c) {
  console.log('  customer 字段:', Object.keys(c).join(', '));
}
console.log('\n  nextFollowUpAt 有值的客户数:', (st.customers ?? []).filter(x => x.nextFollowUpAt).length);
console.log('  marketingStatus 有值的客户数:', (st.customers ?? []).filter(x => x.marketingStatus).length);
console.log('  stage=已流失 客户数:', (st.customers ?? []).filter(x => x.stage === '已流失').length);
