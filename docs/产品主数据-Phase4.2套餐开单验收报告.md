# 产品主数据 — Phase 4.2 套餐开单验收报告

> 日期：2026-08-26 ｜ 状态：代码完成，四道闸全过，待老板界面验收
> 前置：4.1 SKU 库存闭环已完成

## 一、这次做了什么

销售开单支持**套餐**：开单页新增「套餐」Tab → 点套餐卡片打开选配对话框 → 逐单品勾选/选数量/选规格 → 套餐价实时计算 → 存入订单 → 生效后按最小单位（SKU）展开扣减锁定 → 打印明细按套餐分组。

设计核心：**skuLines 平铺到订单行顶层**（数量 = 单套用量 × 单品数量 × 套餐套数），生效计划 `planSkuDemands` 与库存锁定逻辑**零改动**——套餐与单品走同一条扣减链路，不引入第二套库存逻辑。

## 二、验收操作路径（老板自测）

前提：商品管理页已配置好至少 1 个套餐（含 2+ 单品，其中一个数量可选如餐椅×4/×6）。

1. 打开 `localhost:5173` → 销售开单 → 切到「套餐」Tab
2. 点套餐卡片 → 选配对话框：
   - 可选单品有勾选框，取消勾选后**价格立即不再计入**套餐合计
   - 数量选项（如 ×4 / ×6）单选切换，价格同步变化
   - 逐主件选规格（必选主件不选规格时无法保存）
   - 店长视角可见「组件小计/套餐增减价」；员工账号视角只见各单品成品价小计与套餐合计
3. 确认加入 → 购物车出现套餐行（显示含 N 件单品摘要）；同套餐同选配再次添加自动合并套数
4. 保存 → 订单生效 → 库存台账：套餐内每个 SKU 按「单套用量 × 单品数量 × 套数」锁定
5. 打印预览 → 「组件明细（送货验收对照）」区块按套餐分组：套餐 → 单品小分组 → SKU 明细，数量为三重乘积，末行「套餐组合价（含套餐调整）」
6. 取消生效 → 锁定的 SKU 库存全部释放

## 三、实现清单

| 文件 | 改动 |
|---|---|
| `src/types.ts` | OrderItem 加 `packageId/packageCode/packageItems`；新增 `PackageOrderItem` |
| `src/utils/product-config.ts` | 新增 `buildPackageOrderItems`（选配→订单快照，skuLines 平铺）、`summarizePackagePicks`、`packageAvailability`；**修复 `packagePrice` 未勾选单品仍计价的缺陷** |
| `src/features/orders/PackagePicker.tsx` | 新建套餐选配对话框（勾选/数量选项/规格/实时价格/showPricing 门控） |
| `src/features/orders/OrderWorkspacePage.tsx` | 三 Tab（单品/套餐/老商品）、套餐卡片、合并键（同套餐同选配合并套数） |
| `src/features/orders/OrderPreviewModal.tsx` | 打印组件明细套餐分组（三层结构 + 套餐组合价总行） |
| `src/features/orders/order-config.css` / `order-print.css` | 选配对话框与打印分组样式 |

## 四、权限口径（规则 2.6）

- **全员可见**：各单品成品价小计、套餐合计价
- **仅 cost.view（店长）可见**：组件单价、「组件小计」「套餐增减价」字样
- 员工端订单行 skuLines 快照**无成本价**（沿用 Phase 3 机制）

## 五、四道闸结果

| 闸 | 结果 |
|---|---|
| `tsc --noEmit` | 0 错误 |
| `vitest run` | 205/205 全过（含新增 17 个套餐用例；App/CustomersPage 两个已知 flaky 文件单跑通过） |
| `vite build` | 通过（2.93s） |
| `node --test server/server.test.mjs` | 20/20 |

新增测试覆盖：`buildPackageOrderItems` 数量乘法/可选未勾选跳过/引用缺失与缺规格返回 unresolved/合并同 SKU 用量；`packagePrice` 未勾选不计价；`packageAvailability` 现货套数取最小值；开单页套餐流程（选数量×6 → 保存 → skuLines 数量正确、员工端无组件价格字样）。

## 六、已知边界（本期不做）

- 套餐模板改价不影响已保存订单（订单存快照，设计如此）
- 老商品（catalog）不参与套餐
- 报价单打印模式在 4.3（下一步前为 4.7 Excel 导入）
