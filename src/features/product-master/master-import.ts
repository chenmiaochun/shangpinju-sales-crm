import * as XLSX from "xlsx";
import type { ProductCategory, ProductComponent, ComponentSpecDim, ProductSeries, SkuUnit } from "../../types";
import { newId } from "./pm-utils";

// 飞书「尚品居产品数据库」整品格式 → 系统主件 + SKU（一比一导入）
// 列名容错：归一化（去空格/括号）后匹配下列别名
const ALIASES: Record<string, string[]> = {
  category: ["品类", "类目", "category", "categoryname", "类"],
  baseCode: ["基型编号", "基型", "基型代码", "basecode", "basecodename"],
  name: ["产品名称", "名称", "name", "productname"],
  sku: ["产品编号", "编号", "sku", "productcode", "productno"],
  size: ["尺寸(mm)", "尺寸", "size", "specsize", "规格尺寸"],
  material: ["材质", "material", "materialname"],
  price: ["吊牌价", "售价", "price", "销售价", "listprice"],
  cost: ["内部参考价", "成本价", "cost", "costprice", "参考价"],
  status: ["产品状态", "状态", "status", "state"],
  series: ["系列", "series", "seriesname"],
};

// 飞书实测：该 SKU 备注「删除此产品，重复」，导入默认跳过
const SKIP_SKU = "SH-RQ-002-R2";
const ON_SALE = ["在售", "上架", "销售中"];

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, "");
}
const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => Number(value ?? 0);

function buildColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const [logical, aliases] of Object.entries(ALIASES)) {
    const normed = aliases.map(norm);
    for (const header of headers) {
      if (used.has(header)) continue;
      if (normed.includes(norm(header))) {
        map[logical] = header;
        used.add(header);
        break;
      }
    }
  }
  return map;
}

function buildSpecDims(): ComponentSpecDim[] {
  // 整品粒度：维度仅定义名称，不预设取值（同款多规格在飞书是分开的基型）
  return [
    { id: newId(), name: "尺寸", values: [] },
    { id: newId(), name: "材质", values: [] },
  ];
}

export interface MasterParseResult {
  categories: ProductCategory[]; // 仅新建的品类
  series: ProductSeries[]; // 仅新建的产品系列
  components: ProductComponent[]; // 主件
  skuUnits: SkuUnit[]; // SKU
  summary: {
    newCategoryCount: number;
    newSeriesCount: number;
    componentCount: number;
    skuCount: number;
    skippedCount: number;
    errorCount: number;
  };
  skipped: { sku: string; reason: string }[];
  errors: { row: number; messages: string[] }[];
}

export async function readMasterFile(
  file: File,
  existing: {
    categories?: ProductCategory[];
    series?: ProductSeries[];
    skuUnits?: SkuUnit[];
  } = {},
): Promise<MasterParseResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(extension ?? "")) throw new Error("仅支持 Excel 或 CSV 文件");
  const workbook =
    extension === "csv"
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("文件中没有可读取的工作表");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const colMap = buildColumnMap(Object.keys(rows[0] ?? {}));
  const get = (row: Record<string, unknown>, logical: string) => text(row[colMap[logical] ?? ""]);

  const existingCategories = existing.categories ?? [];
  const existingSeries = existing.series ?? [];
  const seenSkus = new Set<string>((existing.skuUnits ?? []).map((s) => s.sku.toLowerCase()));
  const categoryByName = new Map<string, string>();
  const seriesByKey = new Map<string, string>();
  const newCategories: ProductCategory[] = [];
  const newSeries: ProductSeries[] = [];
  const errors: { row: number; messages: string[] }[] = [];
  const skipped: { sku: string; reason: string }[] = [];
  const groups = new Map<
    string,
    { baseCode: string; catId: string; seriesId?: string; rows: { name: string; sku: string; size: string; material: string; price: number; cost: number }[] }
  >();

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const category = get(row, "category");
    const baseCode = get(row, "baseCode");
    const name = get(row, "name");
    const sku = get(row, "sku");
    const status = get(row, "status");

    if (!sku) {
      errors.push({ row: rowNo, messages: ["产品编号不能为空"] });
      return;
    }
    if (sku.trim().toUpperCase() === SKIP_SKU) {
      skipped.push({ sku, reason: "重复记录（飞书备注删除），按规则跳过" });
      return;
    }
    const st = status.trim();
    if (st && !ON_SALE.includes(st)) {
      skipped.push({ sku, reason: `状态「${st}」非在售，跳过` });
      return;
    }
    if (!baseCode) {
      errors.push({ row: rowNo, messages: ["基型编号不能为空"] });
      return;
    }
    const price = number(row[colMap.price]);
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ row: rowNo, messages: ["吊牌价必须是大于等于 0 的数字"] });
      return;
    }
    if (seenSkus.has(sku.trim().toLowerCase())) {
      errors.push({ row: rowNo, messages: [`产品编号「${sku}」重复`] });
      return;
    }
    seenSkus.add(sku.trim().toLowerCase());

    // 品类映射：精确匹配现有大类名称，否则新建
    const cn = norm(category);
    let catId = categoryByName.get(cn);
    if (!catId) {
      const matched = existingCategories.find((c) => norm(c.name) === cn);
      if (matched) {
        catId = matched.id;
      } else {
        const created: ProductCategory = {
          id: newId(),
          name: category.trim() || "未分类",
          code: (category.trim() || `IMP${newCategories.length + 1}`).toUpperCase(),
          sort: newCategories.length,
        };
        newCategories.push(created);
        catId = created.id;
      }
      if (cn) categoryByName.set(cn, catId);
    }

    const cost = number(row[colMap.cost]);
    // 产品系列映射：按「品类 + 系列名」匹配现有或新建；系列名为空 = 归公共/其他
    const seriesName = get(row, "series");
    let seriesId: string | undefined;
    if (seriesName.trim()) {
      const sk = `${catId}|${norm(seriesName)}`;
      seriesId = seriesByKey.get(sk);
      if (!seriesId) {
        const matched = existingSeries.find(
          (s) => s.categoryId === catId && norm(s.name) === norm(seriesName),
        );
        if (matched) {
          seriesId = matched.id;
        } else {
          const created: ProductSeries = {
            id: newId(),
            categoryId: catId,
            name: seriesName.trim(),
            sort: newSeries.length,
          };
          newSeries.push(created);
          seriesId = created.id;
        }
        seriesByKey.set(sk, seriesId);
      }
    }
    const key = baseCode.trim().toUpperCase();
    if (!groups.has(key)) groups.set(key, { baseCode: key, catId, seriesId, rows: [] });
    groups.get(key)!.rows.push({
      name,
      sku: sku.trim(),
      size: get(row, "size"),
      material: get(row, "material"),
      price,
      cost: Number.isFinite(cost) && cost > 0 ? cost : 0,
    });
  });

  const components: ProductComponent[] = [];
  const skuUnits: SkuUnit[] = [];
  groups.forEach((grp) => {
    const compId = newId();
    components.push({
      id: compId,
      categoryId: grp.catId,
      seriesId: grp.seriesId, // 为空 = 公共/其他
      code: grp.baseCode,
      name: grp.rows[0].name || grp.baseCode,
      sort: 0,
      specDims: buildSpecDims(),
    });
    grp.rows.forEach((r) => {
      skuUnits.push({
        id: newId(),
        componentId: compId,
        sku: r.sku,
        specValues: { 尺寸: r.size, 材质: r.material },
        unitPrice: r.price,
        costPrice: r.cost,
        supplyType: "现货", // 飞书无供应方式字段，默认现货
        availableStock: 0,
        reservedStock: 0,
        safetyStock: 0,
        status: "上架",
      });
    });
  });

  return {
    categories: newCategories,
    series: newSeries,
    components,
    skuUnits,
    summary: {
      newCategoryCount: newCategories.length,
      newSeriesCount: newSeries.length,
      componentCount: components.length,
      skuCount: skuUnits.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
    },
    skipped,
    errors,
  };
}

// 下载飞书整品格式导入模板
export function masterImportTemplateXlsx(): ArrayBuffer {
  const headers = ["品类", "基型编号", "产品名称", "产品编号", "尺寸(MM)", "材质", "吊牌价", "内部参考价", "产品状态", "系列"];
  const sample = [
    ["茶台", "CT-SH-001", "简约茶台", "CT-SH-001-120", "1200*600*450", "北美黑胡桃木", 6800, "", "在售", "简约"],
    ["餐台", "DT-JY-001", "简约餐桌(1.6米)", "DT-JY-001-16", "1600*900*750", "北美黑胡桃木", 12800, "", "在售", "简约"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  sheet["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "整品导入模板");
  const guide = XLSX.utils.aoa_to_sheet([
    ["列", "说明", "必填"],
    ["品类", "大类名称，如 茶台/餐台/沙发；系统中已存在同名大类则复用，否则自动新建", "是"],
    ["基型编号", "主件代码，如 CT-SH-001（一比一导入，每个基型生成 1 个主件）", "是"],
    ["产品名称", "整品名称，作为主件名称", "是"],
    ["产品编号", "SKU 编码，如 CT-SH-001-120，系统按此查重", "是"],
    ["尺寸(MM)", "尺寸，原样导入；留空则规格值留空", "否"],
    ["材质", "材质，如 北美黑胡桃木；留空则规格值留空", "否"],
    ["吊牌价", "售价，必为 ≥0 数字", "是"],
    ["内部参考价", "成本价；留空则记为 0（毛利分析标无成本）", "否"],
    ["产品状态", "在售/上架/销售中 才导入；其他状态跳过", "否"],
    ["系列", "产品系列，如 五福系列；同品类下已存在同名系列则复用，否则自动新建；留空归「公共/其他」", "否"],
  ]);
  guide["!cols"] = [{ wch: 14 }, { wch: 50 }, { wch: 6 }];
  XLSX.utils.book_append_sheet(workbook, guide, "字段说明");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
