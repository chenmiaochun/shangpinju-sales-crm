# 产品主数据系统 Phase 5.0：订单页产品库优化

> 老板反馈：销售开单页「产品库单品」tab 现在是 179 条平铺，找一款产品要滚半天；希望按品类 → 系列细分后再点。另外老 demo 商品（客厅套系/实木沙发 等 6 条）仍出现在「商品库」tab，要求清掉。

**完成时间：** 2026-08-29
**改动范围：** 数据脚本 + `OrderWorkspacePage.tsx` UI 重构 + `App.tsx` props 补完 + `productCatalog.ts` seed 收敛

---

## 1. 数据变更（已写入 SQLite `server/data/sales.sqlite`）

`scripts/fix-order-page-data.cjs [--dry]` 幂等脚本，可回放。

| 操作 | Before | After | 说明 |
|---|---|---|---|
| `state.products` 清空 | 6 | 0 | 删掉 6 条 demo（客厅套系 KT-TZ-001、实木沙发 SF-001、餐边柜 CBG-001、实木餐桌 CZ-001、实木茶几 CJ-001、进口床垫 CD-001） |
| `configProducts[].series` 重写 | 全部填成「品类名」（bridge 脚本旧 bug） | 真实系列名 | 解析路径 `skuUnit.componentId → component.seriesId → series.name`；无 seriesId 时回退本品类下 builtin「其他」系列名 |

最终 18 个真实系列 + 各系列数量：

| 系列 | 计数 | 系列 | 计数 |
|---|---|---|---|
| 其他 | 102 | 条形 | 18 |
| 简约 | 15 | 自然边 | 10 |
| 鹅卵石 | 14 | 安晏 | 13 |
| 兰山 | 2 | 马鞍 | 1 |
| 螳螂 | 1 | 葫芦 | 1 |
| 经典 | 1 | 方正 | 1 |
| 五福 | 7 | 禅 | 2 |
| 全如 | 3 | 儒气 | 4 |
| 尚品 | 2 | 心适 | 8 |

> 备份：`backups/sales-backup-2026-08-29-00-01-55-before-order-page-fix.json`

## 2. UI 变更

### 「产品库单品」tab：左侧三级折叠树 + 右侧卡片墙

```
┌─────────────────────┬─────────────────────────────────────────────┐
│ 产品分类             │ 茶台 · 共 45 款                            │
│ 共 179 款单品        │ ┌──────────────────────────────────────┐   │
│                     │ │ 极简茶台 …       ¥5,000  +           │   │
│ 全部 (179)          │ ├──────────────────────────────────────┤   │
│ ▾ 茶台 (45)         │ │ 可拼接长茶台 …   ¥6,200  +           │   │
│   · 其他 (22)       │ ├──────────────────────────────────────┤   │
│   · 简约 (12)       │ │ 鹅卵石 茶台 …     ¥6,800  +           │   │
│   · 鹅卵石 (7)      │ └──────────────────────────────────────┘   │
│   · 葫芦 (1)        │                                             │
│   · 经典 (1)        │                                             │
│   · 条形 (2)        │                                             │
│   · 其他            │                                             │
│ ▾ 餐台 (20)         │                                             │
│   …                 │                                             │
│ ▸ 沙发 (31)         │                                             │
│ …                   │                                             │
└─────────────────────┴─────────────────────────────────────────────┘
```

交互逻辑：
- 默认进入「产品库单品」tab 时，自动选中第一个有单品的品类并展开（让卡片墙不空白，老板打开就有内容看）
- 点击品类：树展开/收起；切换卡片墙只显示该品类所有单品
- 点击系列：卡片墙缩到只显示该系列；左侧仍保持品类展开状态
- 顶部搜索框输入非空时：忽略三级导航，全局扁平化匹配；卡片副标题保留「品类 · 系列」面包屑
- 卡片按钮 `title="选择规格加入选品"` 行为不变 → 打开 `ConfigProductPicker`

### 「商品库」tab：缺省隐藏

`products.length === 0` 时整个 tab 不渲染，避免误点。未来若有 ERP 重新灌入 legacy `products`，tab 自动恢复显示。

### 「产品库套餐」tab：未改动

保持平铺，下一阶段再做套餐分组。

## 3. 代码变更清单

| 文件 | 变更 |
|---|---|
| `src/features/orders/OrderWorkspacePage.tsx` | 加 `categories: ProductCategory[]`、`series: ProductSeries[]` props；新增 `selectedCategoryId`、`selectedSeries`、`expandedCats` 三个 state；新增 `configTree` / `visibleConfig` 两个 `useMemo`；`source === 'config'` 分支重写为 `<aside class="pm-tree"> + <div class="pm-cards">` 双栏布局；`source === 'catalog'` tab 在 products 为空时自动隐藏 |
| `src/features/orders/orders.css` | 追加 `.config-cascade` / `.pm-tree*` / `.pm-cards*` 等约 25 条规则（共 +9060 bytes → 现 9060 bytes） |
| `src/App.tsx` | `<OrderWorkspacePage>` 传 `categories={sales.categories}` `series={sales.series}` |
| `src/productCatalog.ts` | 清空 demo seed 6 行；保留 export `productCatalog: ProductCatalogItem[] = []`，注释指向产品主数据导入入口 |
| `src/features/insights/insights.test.ts` | 去掉对 `supplyType/supplyAdvice` 的硬编码断言（之前依赖 demo 商品）|
| `scripts/fix-order-page-data.cjs` | 新增：清 demo + 修 series 字段的幂等脚本 |

## 4. 四道闸

| 闸门 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ 0 error |
| `vitest run` | ✅ 244/244（修了 insights test 一项历史硬编码）|
| `node --test server/server.test.mjs` | ✅ 20/20 |
| `vite build` | ✅ built in 3.46s，orders chunk 32.82 kB / gz 9.26 kB |

## 5. 已知边界 / 后续工作

- 179 个单品里 102 个归入「其他」系列，下一阶段需要「产品主数据」里把这些 SKU 的 component 完善 `seriesId`（店长批量指派）
- 套餐 tab 仍是平铺，按此模式改造可以下阶段统一处理
- 老板下次刷新页面即可看到效果；vite HMR 已自动应用
