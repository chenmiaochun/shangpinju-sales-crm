import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AfterSalesTicket, Customer, SalesOrder } from "../../types";
import { AfterSalesPage } from "./AfterSalesPage";

const year = new Date().getFullYear();
const old = new Date(Date.now() - 8 * 86400000).toISOString();
const customer: Customer = {
  id: "c1",
  name: "陈女士",
  phone: "13800000000",
  source: "门店",
  salesperson: "小林",
  stage: "已成交",
  intent: "高",
  expectedAmount: 10000,
  products: ["餐桌"],
  style: "原木",
  budget: "1万",
  renovationProgress: "已入住",
  concerns: [],
  lastContactAt: old,
  createdAt: old,
};
const order: SalesOrder = {
  id: "o1",
  orderNo: "NO.0001",
  customerId: "c1",
  customerName: "陈女士",
  contactPhone: "13800000000",
  deliveryAddress: "揭阳",
  salesperson: "小林",
  collaborators: [],
  products: ["餐桌"],
  contractAmount: 10000,
  signedAt: `${year}-01-01`,
  status: "已完成",
  payments: [],
  performanceRate: 100,
  createdAt: old,
  updatedAt: old,
};
const ticket: AfterSalesTicket = {
  id: "t1",
  ticketNo: `SH${year}001`,
  orderId: "o1",
  customerId: "c1",
  customerName: "陈女士",
  contactPhone: "13800000000",
  source: "系统订单",
  category: "质量问题",
  description: "桌面开裂",
  priority: "普通",
  status: "待联系",
  owner: "孙售后",
  feedbackAt: old,
  createdAt: old,
  updatedAt: old,
};
const base = {
  tickets: [ticket],
  orders: [order],
  customers: [customer],
  staff: [{ id: "s1", name: "孙售后" }],
  activeUser: "店长",
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
};

describe("AfterSalesPage", () => {
  it("shows statistics, filters and overdue reminder", () => {
    render(<AfterSalesPage {...base} />);
    expect(screen.getByRole("heading", { name: "售后管理" })).toBeTruthy();
    expect(screen.getByText("超过7天未解决")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("售后类型筛选"), {
      target: { value: "维修" },
    });
    expect(screen.getByText("暂无符合条件的售后工单")).toBeTruthy();
  });

  it("filters the ticket list from KPI cards", () => {
    render(<AfterSalesPage {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /待处理/ }));
    expect((screen.getByLabelText("售后状态筛选") as HTMLSelectElement).value).toBe("待处理");
    expect(screen.getByText("超过7天未解决")).toBeTruthy();
  });

  it("creates a ticket from an order with an automatic number", () => {
    const onAdd = vi.fn();
    render(<AfterSalesPage {...base} tickets={[]} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "新增售后" }));
    fireEvent.click(screen.getByRole("button", { name: "从订单创建" }));
    fireEvent.change(screen.getByLabelText("客户问题描述"), {
      target: { value: "安装后柜门不齐" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建工单" }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketNo: expect.stringMatching(/^SH\d{11}$/),
        orderId: "o1",
        customerName: "陈女士",
        status: "待联系",
        timeline: [expect.objectContaining({ type: "工单创建" })],
      }),
    );
  });
});
