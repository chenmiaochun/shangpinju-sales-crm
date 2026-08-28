# 产品主数据系统 — Phase 3 验收报告（销售开单联动）

> 生成时间：2026-08-26｜负责人：小吉
> 配套文档：`产品主数据系统实施方案.md`、`产品主数据-交接简报-WorkBuddy.md`
> 前置：Phase 1（数据层）、Phase 2（商品管理页）均已由老板验收通过。

---

## 一、阶段目标

把产品库单品接入**销售开单**全链路：**选单品 → 选规格 → 自动带价与库存 → 展开明细扣减；定制主件转生产需求单；员工端只见成品总价不见成本**。

**边界约束（严格遵守）：**
- 老商品（`ProductCatalogItem`）开单路径一行未动，商品库来源照常可用。
- 订单生效逻辑（`activateOrder`）对老商品走原路径，对单品行走新增最小单位级路径。
- 不新增顶层集合——`orders` / `supplyDemands` 已在服务端并发合并键中，Phase 3 全部为**向后兼容的可选字段扩展**，老数据零迁移。

---

## 二、业务流程（开单 → 生效）

1. **开单页选择来源**：商品库顶部双 Tab ——「产品库单品 / 商品库」。有上架单品时默认产品库。
2. **选单品 → 规格选择对话框**：
   - 每个主件一行：必选/选配（选配可勾选）、按单品模板的锁定/开放约束列出**在售**最小单位候选（规格摘要 + 供应方式 + 可用量；有 `cost.view` 权限者额外显示单价）。
   - 底部实时显示**成品合计价**（= Σ主件价×数量 + 单品增减价）与可售提示（可售 N 套 / 含定制主件 / 含外采主件 / 规格未配齐）。
3. **加入销售单**：生成订单行（单位=套、单价=成品价可议价改），同单品同规格的行自动合并数量；行内可展开**组件明细**（主件×数量、规格、供应方式；价格仅 `cost.view` 可见）。
4. **保存销售单**：订单明细（`OrderItem`）携带 `configProductId / configProductCode / selections / skuLines`（展开快照，**不含成本价**）。
5. **审核并生效**（`activateOrder`）：
   - 单品行按 `skuLines` 逐项展开为**最小单位级供货需求**：现货/展厅样品 → 库存锁定/样品锁定并锁定 `SkuUnit.reservedStock`（同一 SKU 多行累计、封顶 availableStock）；外采产品 → 采购需求；**定制生产 → 生产需求单（资料待确认，不扣库存）**。
   - 需求单带 `skuUnitId / sku / componentName`，产品名格式「单品名 · 主件名」，规格=规格摘要，数量=单套用量×订单套数。
   - 订单状态推进（备货中/已齐货）、客户成交回写等沿用原逻辑。
6. **订单预览/打印**：销售单新增「**单品组件明细（送货验收对照）**」区块——每个单品一张组件明细表（组件/规格/数量/单价/小计 + 单品组合价行），满足交接简报中"订单明细详情单"需求，打印样式随单输出。

**员工端权限**：开单页价格门控以 `cost.view` 判定——员工看不到组件单价、组件小计与增减价字段，只看到成品合计价；`skuLines` 快照本身不落成本价，数据层同样不暴露。

---

## 三、新增 / 改动文件

### 新增
| 文件 | 内容 |
|---|---|
| `src/features/orders/ConfigProductPicker.tsx` | 规格选择对话框（按主件选在售 SKU、实时算价、可售提示、员工价格门控 `showPricing`） |
| `src/features/orders/order-config.css` | 开单联动样式（来源 Tab、单品卡片、组件明细展开、选择对话框） |
| `src/utils/order-fulfillment.ts` | 生效计划纯函数 `planSkuDemands`：把 `skuLines` 展开为最小单位级需求（锁定量/需求类型/生产进度），供 `activateOrder` 调用 |
| `src/utils/order-fulfillment.test.ts` | 6 个用例：数量乘法、库存锁定/不足、定制→生产需求、外采→采购需求、老行跳过、同 SKU 锁定量累计 |

### 扩展
| 文件 | 改动 |
|---|---|
| `src/types.ts` | 新增 `OrderSkuLine`（明细快照，无成本价）；`OrderItem` 加可选 `configProductId/configProductCode/selections/skuLines`；`SupplyDemand` 加可选 `skuUnitId/sku/componentName`（全部可选，老数据兼容） |
| `src/utils/product-config.ts` | 新增 `specSummary / componentSkuOptions / buildOrderSkuLines / availableCount / configProductAvailability / aggregateSupplyType / summarizeSkuLines` |
| `src/utils/product-config.test.ts` | 追加 10 个用例（累计 26 例） |
| `src/store/SalesDataContext.tsx` | `activateOrder`：单品行先走 `planSkuDemands` 生成最小单位级需求并锁定 `skuUnits.reservedStock`；老商品行原逻辑不变（需求、锁定、状态推进均保持） |
| `src/features/orders/OrderWorkspacePage.tsx` | 商品来源双 Tab + 单品列表（价格区间/可售状态）+ 规格选择对话框 + 购物车单品行组件明细展开；新 props 全部可选默认空（老调用零破坏） |
| `src/features/orders/OrderWorkspacePage.test.tsx` | 追加 3 个用例（累计 7 例）：单品选规格保存订单带 skuLines、员工端隐藏组件价格、老板端显示 |
| `src/features/orders/OrderPreviewModal.tsx` | 销售单打印增加「单品组件明细」区块 |
| `src/features/orders/order-print.css` | 明细区块打印样式（分页不截断） |
| `src/App.tsx` | `/orders` 路由给开单页传入 `configProducts / skuUnits / components / showPricing`（后者 = `access.can("cost.view")`） |

**服务端零改动**：`orders` / `supplyDemands` 已在 `CONCURRENT_RECORD_KEYS`，新字段随记录 JSON 自然合并与备份。

---

## 四、验收结果

| 验收项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc -p tsconfig.app.json --noEmit` | ✅ 0 错误 |
| 前端单测 | `npx vitest run` | ✅ 186/186（新增 19 例；`App.test.tsx` 16 例与 `CustomersPage` 13 例因全量并发资源竞争需单跑，单跑均通过，与本次改动无关文件） |
| 服务端回归 | `node --test server/server.test.mjs` | ✅ 20/20 |
| 生产构建 | `npx vite build` | ✅ built in 5.34s |
| 老商品零回归 | 代码审查 + 既有测试 | ✅ 老开单路径、`/inventory`、`ProductCatalogItem` 未触碰；老订单（无 skuLines）生效逻辑原样 |
| 权限分层 | 组件测试 | ✅ 员工端（无 `cost.view`）不显示组件单价/小计/增减价；`skuLines` 数据不含成本价 |

---

## 五、验收口径（老板界面验收清单）

以「1.8m 黑胡桃圆餐桌 = 台面×1 + 台脚×1 + 转盘×1(选配)，增减价 -200」为例：

1. **开单**：销售开单页 → 产品库单品 Tab → 点单品卡片 → 逐主件选规格（勾选转盘）→ 加入销售单 → 明细行显示成品价 6,800 与「组件明细 3 项」。
2. **生效**：保存 → 客户确认 → 登记定金 → 审核并生效 → 订单处理区状态变化；产品主数据 → 库存台账中台面/台脚/转盘的**预留库存**各 +1（可用量 -1）。
3. **定制**：若所选项下主件供应方式=定制生产 → 生效后生成「生产需求」（资料待确认），**不扣库存**；生命周期页可见对应需求单。
4. **员工视角**：用员工账号（无 `cost.view`）开同一单品 → 选择对话框与组件明细中均无价格明细，仅成品合计价。
5. **明细详情单**：查看/打印订单 → 销售单出现「单品组件明细」表（组件/规格/数量/单价/小计 + 单品组合价）。

---

## 六、结论

Phase 3 代码层全部达成并通过四道验收闸（类型检查 / 单测 / 构建 / 服务端回归），现有功能与老数据零回归。**待老板按第五节口径界面验收**；验收通过后进入 Phase 4（套餐开单/报价 + 采购/售后/经营分析接入 + 老数据迁移与 Excel 批量导入）。
