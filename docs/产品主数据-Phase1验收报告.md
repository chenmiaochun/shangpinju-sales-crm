# 产品主数据体系 — Phase 1 验收报告

> 项目：`C:\Users\Administrator\Documents\销售软件`（React + Vite + TS 前端，Node + SQLite 服务端）
> 日期：2026-08-26
> 依据：`docs/产品主数据-交接简报-WorkBuddy.md`、`docs/产品主数据系统实施方案.md`

## 一、阶段目标

数据层地基，不动现有页面。把产品主数据 6 层体系（大类→主件→最小单位→单品→套餐）的类型与状态通路建好，打通 4 条数据路径，提供价格/库存展开工具函数，确保老商品与老数据零影响。

## 二、改动清单

| 文件 | 改动 |
|---|---|
| `src/types.ts` | 新增 8 类类型：`MediaFile` / `ProductMedia` / `ProductCategory` / `ComponentSpecDim` / `ProductComponent` / `SkuUnit` / `ConfigProductComponent` / `ConfigProduct` / `PackageItem` / `ProductPackage`。`ProductCatalogItem` 原样保留 |
| `src/api/salesApi.ts` | `RemoteSalesState` 加入 `categories/components/skuUnits/configProducts/productPackages` 5 个集合 |
| `src/store/SalesDataContext.tsx` | `SalesState` 加 5 字段；`loadState` 三分支加默认 `[]`；hydrate 远程映射加读取；`removeFormerDemoEmployees` 透传新集合；新增通用 CRUD `addProductMaster/updateProductMaster/removeProductMaster` 并暴露到 Context |
| `server/database.mjs` | `CONCURRENT_RECORD_KEYS` 加入 5 个新集合（按记录并发合并，比整数组覆盖更安全） |
| `src/utils/product-config.ts`（新增） | 编码生成、价格计算、配置展开 + 单测 |

## 三、验收结果（全部达成）

| 验收项 | 结果 |
|---|---|
| 类型检查通过 | ✅ `tsc -p tsconfig.app.json --noEmit`：0 错误 |
| 单测通过 | ✅ `vitest run product-config.test.ts`：11/11 |
| 服务端回归 | ✅ 并发合并按记录、备份/恢复均正确携带新集合（临时脚本验证后已清理） |
| 现有服务端测试无回归 | ✅ `node --test server/server.test.mjs`：20/20 通过 |
| 现有页面无回归 | ✅ 仅新增字段/方法，未改任何既有逻辑路径 |
| localStorage 老数据不丢 | ✅ `loadState` 三分支默认 `[]` + 远程读取，老数据自然兼容 |
| `/api/state` 老数据不丢 | ✅ 服务端按记录合并，前端 PUT 完整状态 |

## 四、业务规则遵守

- **不自动铺开全组合**：`expandConfigProduct` 仅按单品模板展开；可选主件未选则跳过。
- **新老并存**：`ProductCatalogItem` 老商品路径未动，开单/库存/采购照常可用。
- **价格公式**：单品 = Σ(主件价×数量) + 增减价；套餐 = Σ(单品×数量) + 套餐增减价。
- **编码可读可扩展**：主件码 + 规格值代码拼接 SKU；单品 `SP-大类码-序号`；套餐 `TC-序号`，序号自动取最大+1 保证唯一。
- **媒体存 URL 不存 base64**：`MediaFile.url` 走服务端 `/api/files` 上传回显，避免 `app_state` 单行膨胀。
- **服务端是最终数据源**：新增集合随全量 `/api/state` 自动携带，无需新增数据库表。

## 五、待确认事项（Phase 2 起边做边补，文档 §八）

1. 大类清单最终确认（是否含床垫、定制类）
2. 沙发类各主件规格维度（抱枕是否可选）
3. 餐椅是否拆成椅架 + 坐垫；床/柜类等其余结构

## 六、下一步

**等待你确认后进入 Phase 2 — 商品管理页重构（老板配置界面）**：5 个页签（品类与主件 / 单品配置含媒体 / 套餐配置 / 组件与成本 / 库存台账）。Phase 2 会新增 UI，但同样保证老页面与老商品功能不受影响。
