# 产品主数据系统 — Phase 4.3 ~ 4.6 总验收报告

> 生成时间：2026-08-27 ｜ 负责人：小吉
> 路径：`C:\Users\Administrator\Documents\销售软件`（前端 React+Vite+TS 5173 / 服务端 Node+SQLite 3001）
> 数据链路：`/api/state` 单行 SQLite 为最终数据源；服务端零新增集合，全部走既有 `CONCURRENT_RECORD_KEYS` 自然合并。
> 验收口径：每步过四道闸（`tsc` 0 错 / `vitest` 全过 / `vite build` / 服务端 20/20）。界面验收由老板自测（打开 `localhost:5173` 看），我不做自动化截图。

---

## 一、本轮交付总览

| 模块 | 目标 | 四道闸 | 界面验收 |
|---|---|---|---|
| **4.3 报价单打印模式** | 草稿即报价、双样式打印 | ✅ 全过 | 待老板自测 |
| **4.4 售后接入（断层 C）** | 单品/套餐行退货·换货走 SKU；工单结构化 | ✅ 全过 | 待老板自测 |
| **4.5 产品目录页** | 全员可看的产品图文资料入口 | ✅ 全过 | 待老板自测 |
| **4.6 经营分析接入** | 商品销售排名 / 品类占比 / 毛利分析（cost.view 门控） | ✅ 全过 | 待老板自测 |

最终结果：**前端单测 244 例全过（42 文件）、tsc 0 错、vite build 通过、服务端 20/20。**
（注：全量并发跑偶发 `CustomersPage.test.tsx` 因 jsdom 资源竞争假失败，单跑即过，与本次改动无关。）

---

## 二、4.3 报价单打印模式（订单双打印 · 方案 A）

**改了什么**
- 重写 `src/features/orders/OrderPreviewModal.tsx`：打印预览增加「报价单样式 / 销售单样式」切换。
  - **报价样式**（草稿订单默认）：抬头「尚品居产品报价单」、报价日期 + 有效期（`SalesOrder.quoteValidUntil`，工具栏可编辑并写回）、不出定金/实收订金/大写、不出客户签名区、独立报价条款（3 条）。
  - **销售样式**（非草稿默认）：沿用现状——含定金、签名板、销售条款。
- `src/types.ts`：`SalesOrder` 增加可选 `quoteValidUntil?`。
- 新增 `src/features/orders/order-print.css` 工具栏/模式切换样式。
- 新增 `OrderPreviewModal.test.tsx` 4 例（草稿默认报价、切销售样式、编辑有效期调 `onUpdate`、非草稿默认销售）。

**验收要点（老板自测）**：开单页任意草稿订单 → 打印预览 → 切「报价单」→ 出含组件明细的报价单；生效后订单打印仍是销售单样式。

---

## 三、4.4 售后接入（断层 C 修复 + 工单结构化）

**改了什么**
- `src/store/SalesDataContext.tsx` 重构 `returnOrderItem` / `exchangeOrderItem`：
  - 单品/套餐行（带 `skuLines`）退货 → 按 `skuUnitId` 聚合回加 `SkuUnit.availableStock`、释放对应 `reservedStock`、写带 `skuUnitId` 的「退货入库」流水，订单置「退货中」。
  - 换货 → 旧行按 `skuLines` 回库；新选老商品仍走原扣减路径。
  - **老商品行（无 skuLines）零回归**，仍走原 `products/warehouseStocks` 路径。
- `src/types.ts`：`OrderReturnRecord.skuUnitIds?` / `OrderExchangeRecord.oldSkuUnitIds?` / `AfterSalesTicket` 加 `configProductId?/packageId?/orderItemId?/skuUnitIds?`（与 `productInfo` 文本并存，老工单零迁移）。
- `src/features/after-sales/AfterSalesPage.tsx`：建工单自动带入 `orderItemId`、首个 config/package 引用、`skuUnitIds` 扁平化。
- `SalesDataContext.fulfillment.test.tsx` 追加 3 例（单品退货回库、老商品退货走老路径、换货回库+扣新选老商品）。

**验收要点（老板自测）**：单品订单退货 → SKU 库存回加、台账可见；从该订单建售后工单 → 工单显示是哪个单品的哪些组件。

---

## 四、4.5 产品目录页 + 图片接入

**改了什么**
- 新页面 `src/features/product-catalog/ProductCatalogPage.tsx`（含详情抽屉 `CatalogDrawer`）：
  - 上架单品（`configProducts`）+ 套餐（`productPackages`）卡片流：主图、名称、编码、品类/系列/风格、成品价（用 `configProductPriceRange` / `packagePriceRange`）、可售状态。
  - 筛选：关键词 / 品类 / 系列 / 风格。
  - 详情抽屉：画廊（多图/尺寸图/材质图/颜色图）+ 安装·保养·手册附件下载 + 质检标准 + 适用空间。**成本一律不出现**。
- 新路由 `/products`（`tasks.own` 全员可见，因 `tasks.own` 为全员基础权限）→ 左侧导航「产品目录」。
- `src/App.tsx`：`ProductCatalogPage` lazy 接入 + 导航项 + 路由。
- `src/features/product-catalog/product-catalog.css` 卡片/筛选/抽屉样式（沿用深红 `#8b2424` 体系）。
- 新增 `ProductCatalogPage.test.tsx` 4 例（上架过滤下架、关键词、详情抽屉、系列筛选）。

**验收要点（老板自测）**：任意账号登录 → 左侧出现「产品目录」→ 浏览单品/套餐图文 → 全程看不到成本。

---

## 五、4.6 经营分析接入

**改了什么**
- `src/features/insights/insights.ts` 新增纯函数 `buildProductAnalytics(orders, configProducts, productPackages, skuUnits, categories, legacyProducts, canViewCost, period, now)`：
  - **商品销售排名**：订单行按 `configProductId`（单品）/ `packageId`（套餐）/ `productId`（老商品）三路归一，聚合销量、销售额、排名。
  - **品类占比**：单品→大类（`categoryId`）聚合，各品类销售额占比。
  - **毛利分析**（`canViewCost` 门控）：实时 join `skuUnitId → SkuUnit.costPrice`（老商品用 `product.costPrice`）算售价−成本/毛利率；**无成本数据的行标记「无成本数据」不猜**；快照仍不落成本价。
  - 按 `createdAt` 落在近 7/30/90 天过滤，复用页面周期切换。
- `src/features/insights/SalesInsightsPage.tsx`：新增「商品销售分析」区块（排名 / 品类占比 / 毛利分析三面板），由 App 注入 `orders/configProducts/.../canViewCost={access.can('cost.view')}`。
- `src/features/insights/insights.css` 新增对应样式。
- 新增 2 例测试（订单聚合单品+老商品+品类占比+无 cost.view 不显示毛利；cost.view 时毛利按 SKU 实时核算，单品 56% / 老商品 43% / 综合 51%）。

**验收要点（老板自测）**：老板（`cost.view`）看商品销售排名 + 品类占比 + 毛利率；员工/无 `cost.view` 账号看不到毛利区块，但仍能看到销量与销售额。

---

## 六、双系统并存策略（不变）

- 老系统「商品管理」继续给员工用，新系统「产品主数据」并行开发，现已完成至 4.6。
- 两入口长期共存：不隐藏老菜单、不迁移老数据。统一验收上线后替换老系统。
- 验收方式：老板自测 `localhost:5173` 各新页面，反馈后针对性修改，确认无误再整体替换。

---

## 七、待老板确认 / 收尾

1. 4.3–4.6 界面自测（按各模块「验收要点」）。
2. 确认无误后，按既定策略统一上线、替换老「商品管理」入口。
3. 后续（如需）：Phase 5 全屋定制定型化、按供应商合并采购单等（本期明确出界）。
