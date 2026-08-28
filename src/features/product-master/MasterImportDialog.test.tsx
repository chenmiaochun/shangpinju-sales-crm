import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MasterImportDialog } from "./MasterImportDialog";

const importProductMaster = vi.fn();
const sales = {
  categories: [] as unknown[],
  components: [] as unknown[],
  skuUnits: [] as unknown[],
  configProducts: [] as unknown[],
  productPackages: [] as unknown[],
  addProductMaster: vi.fn(),
  updateProductMaster: vi.fn(),
  removeProductMaster: vi.fn(),
  importProductMaster,
};

vi.mock("../../store/SalesDataContext", () => ({
  useSalesData: () => sales,
}));

const CSV = `品类,基型编号,产品名称,产品编号,尺寸(MM),材质,吊牌价,内部参考价,产品状态,系列
茶台,CT-SH-001,简约茶台,CT-SH-001-120,1200*600*450,北美黑胡桃木,6800,,在售,简约`;

function makeFile(csv: string): File {
  return new File([csv], "t.csv", { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MasterImportDialog", () => {
  it("renders and parses a file into 主件+SKU on confirm", async () => {
    render(<MasterImportDialog onClose={vi.fn()} />);
    expect(screen.getByText("批量导入主件与 SKU")).toBeTruthy();
    expect(screen.getByText("下载导入模板")).toBeTruthy();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(CSV)] } });

    await waitFor(() => expect(screen.getByText("确认导入")).toBeTruthy());

    fireEvent.click(screen.getByText("确认导入"));

    expect(importProductMaster).toHaveBeenCalledTimes(1);
    const arg = importProductMaster.mock.calls[0][0];
    expect(arg.components.length).toBe(1);
    expect(arg.skuUnits.length).toBe(1);
    expect(arg.categories.length).toBe(1);
  });
});
