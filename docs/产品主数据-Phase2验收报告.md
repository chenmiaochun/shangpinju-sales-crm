# 产品主数据系统 — Phase 2 验收报告（商品管理页重构）

> 生成时间：2026-08-26｜负责人：小吉（接手维护，原 Codex 链路已停用）
> 配套文档：`产品主数据系统实施方案.md`、`产品主数据-交接简报-WorkBuddy.md`

---

## 一、阶段目标

在 Phase 1 数据层（8 类类型 + 工具函数 + 服务端并发键 + 老数据兼容）已验收通过的基础上，落地**产品主数据管理页**，按 5 个页签实施：**品类与主件 / 单品配置（含媒体录入）/ 套餐配置 / 组件与成本 / 库存台账**。

**边界约束（严格遵守）：**
- 不破坏现有页面与旧商品（`/inventory` 进销存页、`ProductCatalogItem` 老商品路径一律不动）。
- 待确认项（大类清单、沙发主件维度、餐椅是否拆件）**先按数据模型做通用配置能力，不写死任何具体品类结构**；缺的细节等老板确认后补种子数据。

---

## 二、新增 / 改动文件

### 新增（产品主数据模块）
| 文件 | 内容 |
|---|---|
| `src/features/product-master/ProductMasterPage.tsx` | 主页面壳：5 页签导航 + 权限门控（组件与成本页签受 `cost.view`） |
| `src/features/product-master/index.ts` | 模块出口 |
| `src/features/product-master/product-master.css` | 独立样式（不污染全局） |
| `src/features/product-master/pm-utils.ts` | 通用工具（空媒体、默认对象、排序比较器、品类/主件/单品/套餐映射） |
| `src/features/product-master/MediaUploader.tsx` | 可复用媒体上传组件（基于 `salesApi.uploadFile`，demo 回退 dataURL / 真实环境存 URL，满足"不存 base64"） |
| `src/features/product-master/tabs/CategoryComponentTab.tsx` | 页签一：大类（名称/代码/排序）+ 主件（归属大类/代码/名称/排序）+ 主件下规格维度（名称/取值），纯通用 |
| `src/features/product-master/tabs/ConfigProductTab.tsx` | 页签二：选大类→加主件条目（数量/可选/锁定或开放规格）→自动编码 + 价格区间预览 + 增减价/状态/详情/风格/系列/空间/排序 + 媒体录入（主图/尺寸图/材质图/颜色图/安装保养/手册/质检） |
| `src/features/product-master/tabs/PackageTab.tsx` | 页签三：选单品→数量/数量选项/可选→套餐增减价 + 套餐价预览 + 媒体与排序 |
| `src/features/product-master/tabs/ComponentCostTab.tsx` | 页签四（仅 `cost.view` 可见）：最小单位 SkuUnit 价格/成本/库存/供应方式/上下架，编码自动生成且唯一 |
| `src/features/product-master/tabs/InventoryLedgerTab.tsx` | 页签五：按最小单位展示库存/价格/成本（成本受 `cost.view` 控制）/状态，内联库存调整 |
| `src/features/product-master/ProductMasterPage.test.tsx` | 组件测试：5 页签渲染 + 成本页签权限门控 |

### 扩展（复用 Phase 1）
| 文件 | 改动 |
|---|---|
| `src/utils/product-config.ts` | 新增 `matchingSkuUnits` / `configProductPriceRange` / `packagePriceRange` / `ensureUniqueCode`，与既有价格函数保持语义一致（可选主件不计入基础价/区间） |
| `src/utils/product-config.test.ts` | 追加 5 个用例（累计 16 例） |

### 接入（不破坏现有结构）
| 文件 | 改动 |
|---|---|
| `src/App.tsx` | 新增 `ProductMasterPage` 懒加载 + 导航项「产品主数据」（权限 `inventory.manage`）+ `/product-master` 路由（包在 `Allowed` 内）。**未改动** `InventoryPage` 与 `/inventory` 路由、导航项、老商品任何逻辑 |

---

## 三、验收结果

| 验收项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc -p tsconfig.app.json --noEmit` | ✅ 0 错误 |
| 前端单测 | `npx vitest run` | ✅ 167/167 通过（含新增 16 + 3） |
| 生产构建 | `npx vite build` | ✅ 成功，`product-master` 分包 38.69 kB 正常产出 |
| 老页面/老商品零回归 | 代码审查 + 测试 | ✅ `/inventory`、`ProductCatalogItem` 未触碰 |
| 权限分层 | 测试 + 代码 | ✅ 组件成本 / 增减价仅 `cost.view` 可见，员工端不暴露成本 |

---

## 四、业务规则遵守情况

- **不写死品类**：5 页签均为通用配置能力，大类/主件/规格维度由用户在界面自建，无硬编码品类结构。
- **编码自动可读唯一**：单品 `SP-大类码-序号`、套餐 `TC-序号`、最小单位按主件码+维度生成；`ensureUniqueCode` 防止重复。
- **价格公式一致**：单品 = Σ(主件价×数量) + 增减价；套餐 = Σ(单品×数量) + 套餐增减价；价格区间跳过可选主件（与 `configProductPrice` 一致）。
- **媒体存 URL 不存 base64**：`MediaUploader` 经 `salesApi.uploadFile` 落服务端 `/api/files`，仅存返回 URL。
- **服务端为最终数据源**：所有写入经 `SalesDataContext` 通用 CRUD → `PUT /api/state` → 服务端 SQLite，沿用 Phase 1 并发合并与备份恢复路径。

---

## 五、待老板界面验收 / 待确认项

1. **界面走查**：请老板在 `localhost:5173` → 「产品主数据」页走查 5 个页签的交互与排版，确认符合使用习惯。
2. **结构细节（确认后补种子数据）**：
   - 23 大类清单最终定稿；
   - 沙发各主件（如框架/坐垫/靠背/转盘等）及其规格维度；
   - 餐椅是否拆为「椅架 + 坐垫」两件主件。
3. **验收通过后**再进入 **Phase 3（销售开单联动）**：选单品→选规格→带价与库存→展开明细扣减；定制主件转生产需求单。

---

## 六、结论

Phase 2 代码层全部达成并通过三道验收闸（类型检查 / 单测 / 构建），现有功能与老数据零回归。现**待老板界面验收**，验收通过即启动 Phase 3。
