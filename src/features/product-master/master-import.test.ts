import { describe, it, expect } from "vitest";
import { readMasterFile, masterImportTemplateXlsx } from "./master-import";
import type { ProductCategory, ProductSeries, SkuUnit } from "../../types";

const CSV = `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1200*600*450,北美黑胡桃木,6800,,在售,简约
餐台,DT-JY-001,简约餐桌,DT-JY-001-16,1600*900*750,北美黑胡桃木,12800,,在售,简约
沙发,SH-RQ-002-R2,儒气沙发,SH-RQ-002-R2,,,9999,,在售,
床,BD-JY-003,简约床,BD-JY-003-18,1800*2000,北美黑胡桃木,18000,,停产,简约
椅凳,CH-JY-001,简约椅,CH-JY-001,450*500*900,超纤皮,notanumber,,在售,`;

function makeFile(csv: string): File {
  return new File([csv], "t.csv", { type: "text/csv" });
}

async function parse(
  csv: string,
  existing: { categories?: ProductCategory[]; series?: ProductSeries[]; skuUnits?: SkuUnit[] } = {},
) {
  return readMasterFile(makeFile(csv), existing);
}

describe("readMasterFile", () => {
  it("maps 整品 to 主件+SKU one-to-one with defaults", async () => {
    const r = await parse(CSV);
    // CT + DT 导入；SH-RQ-002-R2 跳过、BD 停产跳过、CH 价格错误
    expect(r.summary.componentCount).toBe(2);
    expect(r.summary.skuCount).toBe(2);
    expect(r.summary.skippedCount).toBe(2);
    expect(r.summary.errorCount).toBe(1);
    expect(r.summary.newCategoryCount).toBe(2); // 仅茶台/餐台新建

    const comp = r.components.find((c) => c.code === "DT-JY-001");
    expect(comp?.name).toBe("简约餐桌");
    const specDimNames = comp?.specDims.map((d) => d.name);
    expect(specDimNames).toEqual(["尺寸", "材质"]);

    const sku = r.skuUnits.find((s) => s.sku === "DT-JY-001-16");
    expect(sku?.componentId).toBe(comp?.id);
    expect(sku?.supplyType).toBe("现货");
    expect(sku?.availableStock).toBe(0);
    expect(sku?.reservedStock).toBe(0);
    expect(sku?.safetyStock).toBe(0);
    expect(sku?.status).toBe("上架");
    expect(sku?.unitPrice).toBe(12800);
    expect(sku?.costPrice).toBe(0); // 内部参考价空
    expect(sku?.specValues["材质"]).toBe("北美黑胡桃木");
    expect(sku?.specValues["尺寸"]).toBe("1600*900*750");
  });

  it("skips SH-RQ-002-R2 duplicate record", async () => {
    const r = await parse(CSV);
    expect(r.skipped.some((s) => s.sku === "SH-RQ-002-R2")).toBe(true);
  });

  it("skips non-on-sale products", async () => {
    const r = await parse(CSV);
    expect(r.skipped.some((s) => s.sku === "BD-JY-003-18")).toBe(true);
  });

  it("reports error on invalid price", async () => {
    const r = await parse(CSV);
    expect(r.errors.some((e) => e.messages.some((m) => m.includes("吊牌价")))).toBe(true);
  });

  it("detects duplicate SKU within file", async () => {
    const dup = `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,A,CT-SH-001-120,1,木,6800,,在售,
茶台,CT-SH-001,B,CT-SH-001-120,2,木,6800,,在售,`;
    const r = await parse(dup);
    expect(r.summary.errorCount).toBe(1);
    expect(r.errors[0].messages.some((m) => m.includes("重复"))).toBe(true);
  });

  it("reuses existing category by name instead of creating", async () => {
    const cats: ProductCategory[] = [
      { id: "cat-existing", name: "茶台", code: "CT", sort: 0 },
    ];
    const r = await parse(
      `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1,木,6800,,在售,`,
      { categories: cats },
    );
    expect(r.summary.newCategoryCount).toBe(0);
    const comp = r.components.find((c) => c.code === "CT-SH-001");
    expect(comp?.categoryId).toBe("cat-existing");
  });

  it("flags duplicate SKU against existing data", async () => {
    const existingSku: SkuUnit = {
      id: "x",
      componentId: "c",
      sku: "CT-SH-001-120",
      specValues: {},
      unitPrice: 1,
      costPrice: 0,
      supplyType: "现货",
      availableStock: 0,
      reservedStock: 0,
      safetyStock: 0,
      status: "上架",
    };
    const r = await parse(
      `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1,木,6800,,在售,`,
      { skuUnits: [existingSku] },
    );
    expect(r.summary.errorCount).toBe(1);
    expect(r.errors[0].messages.some((m) => m.includes("重复"))).toBe(true);
  });

  it("series column creates series per category and links component", async () => {
    const r = await parse(
      `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1,木,6800,,在售,五福系列
餐台,DT-JY-001,简约餐桌,DT-JY-001-16,1,木,12800,,在售,尚品系列`,
    );
    expect(r.summary.newSeriesCount).toBe(2);
    // 两个品类各自独立建系列
    const teaSeries = r.series.find((s) => s.name === "五福系列");
    expect(teaSeries?.categoryId).toBe(r.components.find((c) => c.code === "CT-SH-001")?.categoryId);
    // 主件 seriesId 关联
    expect(r.components.find((c) => c.code === "CT-SH-001")?.seriesId).toBe(teaSeries?.id);
    expect(r.components.find((c) => c.code === "DT-JY-001")?.seriesId).toBe(
      r.series.find((s) => s.name === "尚品系列")?.id,
    );
  });

  it("reuses series in same category instead of creating duplicate", async () => {
    const r = await parse(
      `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1,木,6800,,在售,五福系列
茶台,CT-SH-002,简约茶台2,CT-SH-002-120,1,木,6800,,在售,五福系列`,
    );
    expect(r.summary.newSeriesCount).toBe(1);
    const [s1, s2] = r.components;
    expect(s1.seriesId).toBe(s2.seriesId);
  });

  it("matches existing series by category+name without creating", async () => {
    const cats: ProductCategory[] = [{ id: "cat-1", name: "茶台", code: "CT", sort: 0 }];
    const existingSeries: ProductSeries[] = [
      { id: "s-1", categoryId: "cat-1", name: "五福系列", sort: 0 },
    ];
    const r = await parse(
      `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1,木,6800,,在售,五福系列`,
      { categories: cats, series: existingSeries },
    );
    expect(r.summary.newSeriesCount).toBe(0);
    expect(r.components[0].seriesId).toBe("s-1");
  });

  it("blank series → component falls back to 公共/其他 (seriesId undefined)", async () => {
    const r = await parse(
      `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1,木,6800,,在售,`,
    );
    expect(r.summary.newSeriesCount).toBe(0);
    expect(r.components[0].seriesId).toBeUndefined();
  });
});

describe("masterImportTemplateXlsx", () => {
  it("returns a non-empty xlsx buffer", () => {
    const buf = masterImportTemplateXlsx();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
