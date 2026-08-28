import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryComponentTab } from "./CategoryComponentTab";
import type { ProductCategory, ProductComponent, ProductSeries } from "../../../types";

const category: ProductCategory = {
  id: "cat-1",
  name: "餐桌类",
  code: "CT",
  sort: 0,
};

const sales = {
  categories: [] as ProductCategory[],
  series: [] as ProductSeries[],
  components: [] as ProductComponent[],
  skuUnits: [],
  configProducts: [],
  productPackages: [],
  addProductMaster: vi.fn(),
  updateProductMaster: vi.fn(),
  removeProductMaster: vi.fn(),
  importProductMaster: vi.fn(),
  moveComponentsToSeries: vi.fn(),
};

vi.mock("../../../store/SalesDataContext", () => ({
  useSalesData: () => sales,
}));

beforeEach(() => {
  vi.clearAllMocks();
  sales.categories = [category];
  sales.series = [];
  sales.components = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openCategoryForm() {
  fireEvent.click(screen.getByText("新增大类"));
}

function fillCategoryInputs(name: string, code: string) {
  fireEvent.change(screen.getByPlaceholderText("如 餐桌类"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText("如 CT"), {
    target: { value: code },
  });
}

function openComponentForm() {
  fireEvent.click(screen.getByText("新增主件"));
}

describe("CategoryComponentTab 大类校验", () => {
  it("新增大类：名称和代码都留空 → 提示且不保存", () => {
    render(<CategoryComponentTab />);
    openCategoryForm();
    fireEvent.click(screen.getByText("保存"));
    expect(screen.getByText("请填写名称和代码")).toBeTruthy();
    expect(sales.addProductMaster).not.toHaveBeenCalled();
  });

  it("新增大类：名称填好、代码留空 → 仍提示且不保存", () => {
    render(<CategoryComponentTab />);
    openCategoryForm();
    fillCategoryInputs("餐台类", "");
    fireEvent.click(screen.getByText("保存"));
    expect(screen.getByText("请填写名称和代码")).toBeTruthy();
    expect(sales.addProductMaster).not.toHaveBeenCalled();
  });

  it("新增大类：名称和代码都填好 → 无提示并保存", () => {
    render(<CategoryComponentTab />);
    openCategoryForm();
    fillCategoryInputs("餐台类", "CTM");
    fireEvent.click(screen.getByText("保存"));
    expect(screen.queryByText("请填写名称和代码")).toBeNull();
    expect(sales.addProductMaster).toHaveBeenCalledTimes(1);
    const [collection, item] = sales.addProductMaster.mock.calls[0];
    expect(collection).toBe("categories");
    expect(item.code).toBe("CTM");
  });

  it("新增主件：名称/代码留空 → 提示「请选择所属大类，并填写名称和代码」且不保存", () => {
    render(<CategoryComponentTab />);
    openComponentForm();
    fireEvent.click(screen.getByText("保存"));
    expect(
      screen.getByText("请选择所属大类，并填写名称和代码"),
    ).toBeTruthy();
    expect(sales.addProductMaster).not.toHaveBeenCalled();
  });
});

describe("CategoryComponentTab 产品系列", () => {
  it("三栏布局：大类 / 产品系列 / 主件，且大类自带内置「公共/其他」", () => {
    render(<CategoryComponentTab />);
    expect(screen.getByText("大类")).toBeTruthy();
    expect(screen.getByText("产品系列")).toBeTruthy();
    expect(screen.getByText("主件")).toBeTruthy();
    expect(screen.getByText("公共/其他")).toBeTruthy();
    expect(screen.getByText("内置 · 存放通用配件")).toBeTruthy();
  });

  it("公共/其他为内置系列无删除按钮；自定义系列有删除按钮", () => {
    sales.series = [{ id: "s1", categoryId: "cat-1", name: "五福系列", sort: 0 }];
    render(<CategoryComponentTab />);
    const publicLi = screen.getByText("公共/其他").closest("li")!;
    expect(publicLi.querySelector('[aria-label*="删除"]')).toBeNull();
    const customLi = screen.getByText("五福系列").closest("li")!;
    expect(customLi.querySelector('[aria-label*="删除"]')).not.toBeNull();
  });

  it("新增系列：填写名称保存 → addProductMaster('series', item)", () => {
    render(<CategoryComponentTab />);
    fireEvent.click(screen.getByText("新增系列"));
    fireEvent.change(screen.getByPlaceholderText("如 五福系列"), {
      target: { value: "心适系列" },
    });
    fireEvent.click(screen.getByText("保存"));
    expect(sales.addProductMaster).toHaveBeenCalledTimes(1);
    const [collection, item] = sales.addProductMaster.mock.calls[0];
    expect(collection).toBe("series");
    expect(item.name).toBe("心适系列");
    expect(item.categoryId).toBe("cat-1");
  });

  it("新增主件：归属系列默认公共/其他 → 保存时 seriesId 为空", () => {
    render(<CategoryComponentTab />);
    openComponentForm();
    fireEvent.change(screen.getByPlaceholderText("如 五福框架"), {
      target: { value: "五金脚" },
    });
    fireEvent.change(screen.getByPlaceholderText("如 WFKJ"), {
      target: { value: "WJJ" },
    });
    const select = screen.getByLabelText("归属产品系列") as HTMLSelectElement;
    expect(select.value).toBe("series-public");
    fireEvent.click(screen.getByText("保存"));
    const [, item] = sales.addProductMaster.mock.calls[0];
    expect(item.seriesId).toBeUndefined();
  });

  it("新增主件：选择自定义系列 → 保存时 seriesId 写入", () => {
    sales.series = [{ id: "s1", categoryId: "cat-1", name: "五福系列", sort: 0 }];
    render(<CategoryComponentTab />);
    openComponentForm();
    fireEvent.change(screen.getByPlaceholderText("如 五福框架"), {
      target: { value: "五福框架" },
    });
    fireEvent.change(screen.getByPlaceholderText("如 WFKJ"), {
      target: { value: "WFKJ" },
    });
    fireEvent.change(screen.getByLabelText("归属产品系列"), {
      target: { value: "s1" },
    });
    fireEvent.click(screen.getByText("保存"));
    const [, item] = sales.addProductMaster.mock.calls[0];
    expect(item.seriesId).toBe("s1");
  });

  it("选中系列后只展示该系列主件（历史主件默认归公共/其他）", () => {
    sales.series = [{ id: "s1", categoryId: "cat-1", name: "五福系列", sort: 0 }];
    sales.components = [
      { id: "c1", categoryId: "cat-1", seriesId: "s1", code: "WFKJ", name: "五福框架", sort: 0, specDims: [] },
      { id: "c2", categoryId: "cat-1", code: "WJJ", name: "五金脚", sort: 0, specDims: [] },
    ];
    render(<CategoryComponentTab />);
    // 默认选中公共/其他 → 只见五金脚
    expect(screen.getByText("五金脚")).toBeTruthy();
    expect(screen.queryByText("五福框架")).toBeNull();
    // 切到五福系列 → 只见五福框架
    fireEvent.click(screen.getByText("五福系列"));
    expect(screen.getByText("五福框架")).toBeTruthy();
    expect(screen.queryByText("五金脚")).toBeNull();
  });
});

describe("CategoryComponentTab 批量迁移", () => {
  it("批量迁移：勾选主件 → 选目标系列 → moveComponentsToSeries", () => {
    sales.series = [{ id: "s1", categoryId: "cat-1", name: "五福系列", sort: 0 }];
    sales.components = [
      { id: "c1", categoryId: "cat-1", code: "WJJ", name: "五金脚", sort: 0, specDims: [] },
      { id: "c2", categoryId: "cat-1", code: "WJT", name: "五金条", sort: 0, specDims: [] },
    ];
    render(<CategoryComponentTab />);
    fireEvent.click(screen.getByText("批量迁移"));
    fireEvent.click(screen.getByLabelText("选择 五金脚"));
    const bar = screen.getByText(/个主件，迁至：/).closest("div")!;
    fireEvent.change(bar.querySelector("select")!, { target: { value: "s1" } });
    fireEvent.click(screen.getByText("确认迁移"));
    expect(sales.moveComponentsToSeries).toHaveBeenCalledWith(["c1"], "s1");
  });

  it("批量迁移：目标选公共/其他 → seriesId 传 undefined", () => {
    sales.components = [
      { id: "c1", categoryId: "cat-1", seriesId: "s1", code: "WFKJ", name: "五福框架", sort: 0, specDims: [] },
    ];
    sales.series = [{ id: "s1", categoryId: "cat-1", name: "五福系列", sort: 0 }];
    render(<CategoryComponentTab />);
    fireEvent.click(screen.getByText("五福系列"));
    fireEvent.click(screen.getByText("批量迁移"));
    fireEvent.click(screen.getByLabelText("选择 五福框架"));
    // 目标默认公共/其他
    fireEvent.click(screen.getByText("确认迁移"));
    expect(sales.moveComponentsToSeries).toHaveBeenCalledWith(["c1"], undefined);
  });

  it("删除系列：其下主件迁回公共/其他，并删除系列", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    sales.series = [{ id: "s1", categoryId: "cat-1", name: "五福系列", sort: 0 }];
    sales.components = [
      { id: "c1", categoryId: "cat-1", seriesId: "s1", code: "WFKJ", name: "五福框架", sort: 0, specDims: [] },
    ];
    render(<CategoryComponentTab />);
    fireEvent.click(screen.getByText("五福系列"));
    fireEvent.click(screen.getByLabelText("删除 五福系列"));
    expect(sales.moveComponentsToSeries).toHaveBeenCalledWith(["c1"], undefined);
    expect(sales.removeProductMaster).toHaveBeenCalledWith("series", "s1");
  });
});
