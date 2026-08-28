import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductMasterPage } from "./ProductMasterPage";

const baseSales = {
  categories: [],
  components: [],
  skuUnits: [],
  configProducts: [],
  productPackages: [],
  addProductMaster: vi.fn(),
  updateProductMaster: vi.fn(),
  removeProductMaster: vi.fn(),
};

vi.mock("../../store/SalesDataContext", () => ({
  useSalesData: () => baseSales,
}));

const h = vi.hoisted(() => ({ canCost: true }));
vi.mock("../../features/team", () => ({
  useRoleAccess: () => ({
    can: (p: string) => (p === "cost.view" ? h.canCost : true),
  }),
}));

describe("ProductMasterPage", () => {
  it("renders all 5 tabs when component/cost is visible", () => {
    h.canCost = true;
    render(<ProductMasterPage />);
    expect(screen.getByText("品类与主件")).toBeTruthy();
    expect(screen.getByText("单品配置")).toBeTruthy();
    expect(screen.getByText("套餐配置")).toBeTruthy();
    expect(screen.getByText("组件与成本")).toBeTruthy();
    expect(screen.getByText("库存台账")).toBeTruthy();
  });

  it("hides 组件与成本 tab when cost.view is not granted", () => {
    h.canCost = false;
    render(<ProductMasterPage />);
    expect(screen.getByText("品类与主件")).toBeTruthy();
    expect(screen.queryByText("组件与成本")).toBeNull();
  });

  it("shows the category editor by default", () => {
    h.canCost = true;
    render(<ProductMasterPage />);
    expect(screen.getByText("新增大类")).toBeTruthy();
  });
});
