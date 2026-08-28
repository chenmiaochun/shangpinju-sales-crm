import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Plus,
  Search,
  Wrench,
} from "lucide-react";
import type {
  AfterSalesStatus,
  AfterSalesTicket,
  Customer,
  CustomerFile,
  SalesOrder,
} from "../../types";
import "./after-sales.css";

type Props = {
  tickets: AfterSalesTicket[];
  orders: SalesOrder[];
  customers: Customer[];
  staff: { id: string; name: string }[];
  activeUser: string;
  initialOrderId?: string;
  onAdd: (ticket: AfterSalesTicket) => void;
  onUpdate: (id: string, changes: Partial<AfterSalesTicket>) => void;
};
type KpiFilter = "本月新增" | "待处理" | "已解决" | "";
const nowYear = () => new Date().getFullYear();
const day = 86400000;
const monthStart = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
};
const monthEnd = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
};
const ticketNo = (tickets: AfterSalesTicket[]) => {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const count =
    tickets.filter((t) => (t.ticketNo ?? "").startsWith(`SH${stamp}`)).length +
    1;
  return `SH${stamp}${String(count).padStart(3, "0")}`;
};
const ageDays = (value: string) =>
  Math.floor((Date.now() - new Date(value).getTime()) / day);
const normalizeStatus = (status: AfterSalesStatus): AfterSalesStatus =>
  status === "待受理"
    ? "待联系"
    : status === "处理中"
      ? "已上门处理中"
      : status === "待客户确认"
        ? "已解决"
        : status === "已完成"
          ? "已关闭"
          : status;
const isClosed = (ticket: AfterSalesTicket) =>
  ["已解决", "已关闭", "已完成"].includes(ticket.status);
const alertKind = (ticket: AfterSalesTicket) => {
  if (!isClosed(ticket) && ageDays(ticket.feedbackAt ?? ticket.createdAt) > 7)
    return "overdue";
  if (!ticket.contacted && ageDays(ticket.feedbackAt ?? ticket.createdAt) > 3)
    return "uncontacted";
  if (ticket.appointmentAt) {
    const hours =
      (new Date(ticket.appointmentAt).getTime() - Date.now()) / 3600000;
    if (hours >= 0 && hours <= 24) return "visit";
  }
  return "";
};
const readFiles = async (files: FileList | null): Promise<CustomerFile[]> =>
  Promise.all(
    Array.from(files ?? []).map(
      (file) =>
        new Promise<CustomerFile>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: `af-file-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl: String(reader.result),
              category: "其他",
              uploadedAt: new Date().toISOString(),
            });
          reader.readAsDataURL(file);
        }),
    ),
  );

export function AfterSalesPage(props: Props) {
  const [tab, setTab] = useState<"今年售后" | "历史售后">("今年售后");
  const [year, setYear] = useState(nowYear() - 1);
  const [status, setStatus] = useState("全部");
  const [type, setType] = useState("全部");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeKpi, setActiveKpi] = useState<KpiFilter>("");
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(Boolean(props.initialOrderId));
  const currentYear = nowYear();
  const years = [
    ...new Set(
      props.tickets
        .map((t) => new Date(t.feedbackAt ?? t.createdAt).getFullYear())
        .filter((y) => y < currentYear),
    ),
  ].sort((a, b) => b - a);
  const filtered = useMemo(
    () =>
      props.tickets
        .filter((ticket) => {
          const ticketYear = new Date(
            ticket.feedbackAt ?? ticket.createdAt,
          ).getFullYear();
          const inTab =
            tab === "今年售后"
              ? ticketYear === currentYear
              : ticketYear === year;
          const text =
            `${ticket.customerName}${ticket.contactPhone ?? ""}${ticket.ticketNo ?? ticket.id}`.toLowerCase();
          const date = (ticket.feedbackAt ?? ticket.createdAt).slice(0, 10);
          const normalizedStatus = normalizeStatus(ticket.status);
          const statusMatched =
            status === "全部" ||
            (status === "待处理" ? !isClosed(ticket) : normalizedStatus === status);
          return (
            inTab &&
            statusMatched &&
            (type === "全部" || ticket.category === type) &&
            (!query || text.includes(query.toLowerCase())) &&
            (!from || date >= from) &&
            (!to || date <= to)
          );
        })
        .sort(
          (a, b) =>
            (alertKind(b) === "overdue" ? 1 : 0) -
              (alertKind(a) === "overdue" ? 1 : 0) ||
            String(b.feedbackAt ?? b.createdAt).localeCompare(
              String(a.feedbackAt ?? a.createdAt),
            ),
        ),
    [props.tickets, tab, year, status, type, query, from, to, currentYear],
  );
  const selected = props.tickets.find((t) => t.id === selectedId);
  const month = new Date().toISOString().slice(0, 7);
  const monthly = props.tickets.filter((t) =>
    (t.feedbackAt ?? t.createdAt).startsWith(month),
  );
  const solved = monthly.filter(isClosed);
  const avg = solved.length
    ? solved.reduce(
        (sum, t) =>
          sum +
          Math.max(
            0,
            (new Date(t.resolvedAt ?? t.updatedAt).getTime() -
              new Date(t.feedbackAt ?? t.createdAt).getTime()) /
              day,
          ),
        0,
      ) / solved.length
    : 0;
  const applyKpiFilter = (filter: KpiFilter) => {
    setActiveKpi(filter);
    setTab("今年售后");
    setQuery("");
    setType("全部");
    setFrom(monthStart());
    setTo(monthEnd());
    if (filter === "待处理") setStatus("待处理");
    else if (filter === "已解决") setStatus("已解决");
    else setStatus("全部");
  };
  if (selected)
    return (
      <TicketDetail
        ticket={selected}
        order={props.orders.find((o) => o.id === selected.orderId)}
        staff={props.staff}
        activeUser={props.activeUser}
        onBack={() => setSelectedId("")}
        onUpdate={(changes) => props.onUpdate(selected.id, changes)}
      />
    );
  return (
    <main className="after-sales-page">
      <header>
        <div>
          <p>客户服务</p>
          <h1>售后管理</h1>
          <span>集中记录反馈、联系、上门、处理与客户确认全过程。</span>
        </div>
        <button onClick={() => setCreating(true)}>
          <Plus />
          新增售后
        </button>
      </header>
      <section className="after-sales-kpis">
        <Kpi
          label="本月新增售后"
          value={`${monthly.length} 单`}
          active={activeKpi === "本月新增"}
          onClick={() => applyKpiFilter("本月新增")}
        />
        <Kpi
          label="待处理"
          value={`${monthly.filter((t) => !isClosed(t)).length} 单`}
          active={activeKpi === "待处理"}
          onClick={() => applyKpiFilter("待处理")}
          warn
        />
        <Kpi
          label="已解决"
          value={`${solved.length} 单`}
          active={activeKpi === "已解决"}
          onClick={() => applyKpiFilter("已解决")}
        />
        <Kpi
          label="解决率"
          value={`${monthly.length ? Math.round((solved.length / monthly.length) * 100) : 0}%`}
          onClick={() => applyKpiFilter("本月新增")}
        />
        <Kpi
          label="平均解决时长"
          value={`${avg.toFixed(1)} 天`}
          onClick={() => applyKpiFilter("已解决")}
        />
      </section>
      <nav className="after-sales-tabs">
        <button
          className={tab === "今年售后" ? "active" : ""}
          onClick={() => { setTab("今年售后"); setActiveKpi(""); }}
        >
          今年售后
        </button>
        <button
          className={tab === "历史售后" ? "active" : ""}
          onClick={() => { setTab("历史售后"); setActiveKpi(""); }}
        >
          历史售后
        </button>
        {tab === "历史售后" && (
          <select
            aria-label="历史售后年份"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {(years.length ? years : [currentYear - 1]).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        )}
      </nav>
      <section className="after-sales-filters">
        <label>
          <Search />
          <input
            aria-label="搜索客户或电话"
            placeholder="客户名称、电话、售后单号"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveKpi(""); }}
          />
        </label>
        <select
          aria-label="售后状态筛选"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setActiveKpi(""); }}
        >
          <option>全部</option>
          <option>待处理</option>
          <option>待联系</option>
          <option>已联系待上门</option>
          <option>已上门处理中</option>
          <option>已解决</option>
          <option>已关闭</option>
          <option>需换货</option>
          <option>需退货</option>
          <option>需厂家支持</option>
        </select>
        <select
          aria-label="售后类型筛选"
          value={type}
          onChange={(e) => { setType(e.target.value); setActiveKpi(""); }}
        >
          <option>全部</option>
          <option>质量问题</option>
          <option>安装问题</option>
          <option>换货</option>
          <option>退货</option>
          <option>维修</option>
          <option>其他</option>
        </select>
        <input
          aria-label="反馈开始日期"
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setActiveKpi(""); }}
        />
        <input
          aria-label="反馈结束日期"
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setActiveKpi(""); }}
        />
      </section>
      <section className="after-sales-table">
        <div className="after-sales-row head">
          <span>售后单 / 订单</span>
          <span>客户</span>
          <span>类型 / 反馈时间</span>
          <span>状态</span>
          <span>上门时间</span>
          <span>负责人</span>
          <span>操作</span>
        </div>
        {filtered.map((ticket) => {
          const alert = alertKind(ticket);
          return (
            <article className={`after-sales-row ${alert}`} key={ticket.id}>
              <span>
                <b>{ticket.ticketNo ?? ticket.id}</b>
                {ticket.source === "系统订单" ? (
                  <a
                    href={`#/lifecycle?order=${encodeURIComponent(ticket.orderId)}`}
                  >
                    {props.orders.find((o) => o.id === ticket.orderId)
                      ?.orderNo ?? ticket.orderId}
                  </a>
                ) : (
                  <small>历史客户</small>
                )}
              </span>
              <span>
                <b>{ticket.customerName}</b>
                <small>{ticket.contactPhone || "电话未登记"}</small>
              </span>
              <span>
                <b>{ticket.category}</b>
                <small>
                  {(ticket.feedbackAt ?? ticket.createdAt)
                    .replace("T", " ")
                    .slice(0, 16)}
                </small>
              </span>
              <span>
                <i>{normalizeStatus(ticket.status)}</i>
                {alert && (
                  <small>
                    <AlertTriangle />
                    {alert === "overdue"
                      ? "超过7天未解决"
                      : alert === "uncontacted"
                        ? "超过3天未联系"
                        : "上门时间临近"}
                  </small>
                )}
              </span>
              <span>
                {ticket.appointmentAt?.replace("T", " ").slice(0, 16) ||
                  "待预约"}
              </span>
              <span>{ticket.owner || "待分配"}</span>
              <span>
                <button onClick={() => setSelectedId(ticket.id)}>
                  查看详情 / 处理
                </button>
              </span>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="after-sales-empty">
            <Wrench />
            <strong>暂无符合条件的售后工单</strong>
          </div>
        )}
      </section>
      {creating && (
        <CreateTicketDialog
          {...props}
          initialOrderId={props.initialOrderId}
          onClose={() => setCreating(false)}
          onCreated={(ticket) => {
            props.onAdd(ticket);
            setCreating(false);
            setSelectedId(ticket.id);
          }}
        />
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  active,
  onClick,
  warn,
}: {
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${warn ? "warn" : ""} ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function CreateTicketDialog(
  props: Props & {
    onClose: () => void;
    onCreated: (ticket: AfterSalesTicket) => void;
  },
) {
  const [mode, setMode] = useState<"订单" | "手动">(
    props.initialOrderId ? "订单" : "手动",
  );
  const [orderId, setOrderId] = useState(
    props.initialOrderId ?? props.orders[0]?.id ?? "",
  );
  const [manual, setManual] = useState({ name: "", phone: "", address: "" });
  const [category, setCategory] =
    useState<AfterSalesTicket["category"]>("质量问题");
  const [description, setDescription] = useState("");
  const [feedbackSource, setFeedbackSource] =
    useState<AfterSalesTicket["feedbackSource"]>("电话");
  const [owner, setOwner] = useState(props.staff[0]?.name ?? props.activeUser);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const order = props.orders.find((o) => o.id === orderId);
  return (
    <div className="after-sales-backdrop">
      <section
        role="dialog"
        aria-label="新增售后工单"
        className="after-sales-dialog"
      >
        <header>
          <h2>新增售后工单</h2>
          <button onClick={props.onClose}>×</button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const now = new Date().toISOString();
            const customer = props.customers.find(
              (c) => c.id === order?.customerId,
            );
            const ticket: AfterSalesTicket = {
              id: `ticket-${Date.now()}`,
              ticketNo: ticketNo(props.tickets),
              orderId: order?.id ?? `legacy-${Date.now()}`,
              customerId: order?.customerId ?? `legacy-${Date.now()}`,
              customerName: order?.customerName ?? manual.name,
              source: order ? "系统订单" : "历史客户",
              contactPhone:
                order?.contactPhone ?? customer?.phone ?? manual.phone,
              address:
                order?.deliveryAddress ?? customer?.cityArea ?? manual.address,
              orderItemId: order?.items?.[0]?.id,
              configProductId: order?.items?.find((i) => i.configProductId)
                ?.configProductId,
              packageId: order?.items?.find((i) => i.packageId)?.packageId,
              skuUnitIds: (order?.items ?? []).flatMap((i) =>
                (i.skuLines ?? []).map((l) => l.skuUnitId),
              ),
              productInfo: order?.products.join("、"),
              purchaseAt: order?.signedAt,
              category,
              description,
              priority: "普通",
              status: "待联系",
              owner,
              feedbackAt: now,
              feedbackSource,
              feedbackPerson: "客户本人",
              feedbackFiles: files,
              timeline: [
                {
                  id: `timeline-${Date.now()}`,
                  type: "工单创建",
                  at: now,
                  operator: props.activeUser,
                  detail: description,
                },
              ],
              createdAt: now,
              updatedAt: now,
            };
            props.onCreated(ticket);
          }}
        >
          <div className="source-switch">
            <button
              type="button"
              className={mode === "订单" ? "active" : ""}
              onClick={() => setMode("订单")}
            >
              从订单创建
            </button>
            <button
              type="button"
              className={mode === "手动" ? "active" : ""}
              onClick={() => setMode("手动")}
            >
              手动新建
            </button>
          </div>
          {mode === "订单" ? (
            <label>
              关联订单
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                {props.orders.map((order) => (
                  <option value={order.id} key={order.id}>
                    {order.orderNo} · {order.customerName} ·{" "}
                    {order.products.join("、")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="manual-fields">
              <label>
                客户名称
                <input
                  required
                  value={manual.name}
                  onChange={(e) =>
                    setManual({ ...manual, name: e.target.value })
                  }
                />
              </label>
              <label>
                联系电话
                <input
                  required
                  value={manual.phone}
                  onChange={(e) =>
                    setManual({ ...manual, phone: e.target.value })
                  }
                />
              </label>
              <label>
                送货地址
                <input
                  value={manual.address}
                  onChange={(e) =>
                    setManual({ ...manual, address: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          <label>
            售后类型
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AfterSalesTicket["category"])
              }
            >
              <option>质量问题</option>
              <option>安装问题</option>
              <option>换货</option>
              <option>退货</option>
              <option>维修</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            反馈来源
            <select
              value={feedbackSource}
              onChange={(e) =>
                setFeedbackSource(
                  e.target.value as AfterSalesTicket["feedbackSource"],
                )
              }
            >
              <option>电话</option>
              <option>微信</option>
              <option>到店</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            负责人
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {props.staff.map((person) => (
                <option key={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
          <label>
            客户问题描述
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            问题图片 / 视频
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={async (e) => setFiles(await readFiles(e.target.files))}
            />
            <small>{files.map((file) => file.name).join("、")}</small>
          </label>
          <footer>
            <button type="button" onClick={props.onClose}>
              取消
            </button>
            <button>创建工单</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function TicketDetail({
  ticket,
  order,
  staff,
  activeUser,
  onBack,
  onUpdate,
}: {
  ticket: AfterSalesTicket;
  order?: SalesOrder;
  staff: { id: string; name: string }[];
  activeUser: string;
  onBack: () => void;
  onUpdate: (changes: Partial<AfterSalesTicket>) => void;
}) {
  const [draft, setDraft] = useState({
    ...ticket,
    status: normalizeStatus(ticket.status),
  });
  const save = (
    eventType:
      | "状态变更"
      | "首次联系客户"
      | "预约上门"
      | "上门处理"
      | "解决完成"
      | "客户确认" = "状态变更",
  ) => {
    const now = new Date().toISOString();
    onUpdate({
      ...draft,
      updatedAt: now,
      timeline: [
        ...(ticket.timeline ?? []),
        {
          id: `timeline-${Date.now()}`,
          type: eventType,
          at: now,
          operator: activeUser,
          detail: `状态：${draft.status}`,
        },
      ],
    });
  };
  return (
    <main className="after-sales-detail">
      <header>
        <button onClick={onBack}>
          <ArrowLeft />
          返回售后列表
        </button>
        <div>
          <span>售后工单</span>
          <h1>{ticket.ticketNo ?? ticket.id}</h1>
        </div>
        <select
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as AfterSalesStatus })
          }
        >
          <option>待联系</option>
          <option>已联系待上门</option>
          <option>已上门处理中</option>
          <option>已解决</option>
          <option>已关闭</option>
          <option>需换货</option>
          <option>需退货</option>
          <option>需厂家支持</option>
        </select>
      </header>
      <section className="ticket-section basic">
        <h2>基本信息</h2>
        <dl>
          <div>
            <dt>关联订单</dt>
            <dd>
              {order ? (
                <a href={`#/lifecycle?order=${order.id}`}>{order.orderNo}</a>
              ) : (
                "历史客户"
              )}
            </dd>
          </div>
          <div>
            <dt>客户</dt>
            <dd>
              {draft.customerName} · {draft.contactPhone}
            </dd>
          </div>
          <div>
            <dt>地址</dt>
            <dd>{draft.address || "未登记"}</dd>
          </div>
          <div>
            <dt>售后类型</dt>
            <dd>{draft.category}</dd>
          </div>
          <div>
            <dt>反馈时间</dt>
            <dd>{draft.feedbackAt ?? draft.createdAt}</dd>
          </div>
          <div>
            <dt>负责人</dt>
            <dd>
              <select
                value={draft.owner}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              >
                {staff.map((person) => (
                  <option key={person.id}>{person.name}</option>
                ))}
              </select>
            </dd>
          </div>
        </dl>
      </section>
      <section className="detail-columns">
        <Editable title="售后反馈">
          <label>
            问题描述
            <textarea
              rows={5}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            反馈来源
            <select
              value={draft.feedbackSource ?? "电话"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  feedbackSource: e.target
                    .value as AfterSalesTicket["feedbackSource"],
                })
              }
            >
              <option>电话</option>
              <option>微信</option>
              <option>到店</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            反馈人
            <input
              value={draft.feedbackPerson ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, feedbackPerson: e.target.value })
              }
            />
          </label>
          <label>
            补充问题图片 / 视频
            <input type="file" multiple accept="image/*,video/*" onChange={async(e)=>setDraft({...draft,feedbackFiles:[...(draft.feedbackFiles??[]),...await readFiles(e.target.files)]})}/>
          </label>
          <FileGallery files={draft.feedbackFiles} />
        </Editable>
        <Editable title="联系记录">
          <label>
            <input
              type="checkbox"
              checked={draft.contacted ?? false}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  contacted: e.target.checked,
                  contactedAt: e.target.checked
                    ? new Date().toISOString()
                    : undefined,
                  status: e.target.checked ? "已联系待上门" : draft.status,
                })
              }
            />{" "}
            已联系客户
          </label>
          <label>
            联系时间
            <input
              type="datetime-local"
              value={draft.contactedAt?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, contactedAt: e.target.value })
              }
            />
          </label>
          <label>
            联系方式
            <select
              value={draft.contactMethod ?? "电话"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  contactMethod: e.target
                    .value as AfterSalesTicket["contactMethod"],
                })
              }
            >
              <option>电话</option>
              <option>微信</option>
              <option>上门</option>
            </select>
          </label>
          <label>
            沟通内容
            <textarea
              value={draft.contactNote ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, contactNote: e.target.value })
              }
            />
          </label>
          <label>
            下次联系
            <input
              type="datetime-local"
              value={draft.nextContactAt?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, nextContactAt: e.target.value })
              }
            />
          </label>
        </Editable>
        <Editable title="上门处理">
          <label>
            预约上门
            <input
              type="datetime-local"
              value={draft.appointmentAt?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, appointmentAt: e.target.value })
              }
            />
          </label>
          <label>
            实际上门
            <input
              type="datetime-local"
              value={draft.visitedAt?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  visitedAt: e.target.value,
                  status: e.target.value ? "已上门处理中" : draft.status,
                })
              }
            />
          </label>
          <label>
            上门人员
            <input
              value={draft.visitor ?? ""}
              onChange={(e) => setDraft({ ...draft, visitor: e.target.value })}
            />
          </label>
          <label>
            具体问题
            <textarea
              value={draft.onsiteProblem ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, onsiteProblem: e.target.value })
              }
            />
          </label>
          <label>
            处理方案
            <select
              value={draft.solutionType ?? "维修"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  solutionType: e.target
                    .value as AfterSalesTicket["solutionType"],
                })
              }
            >
              <option>维修</option>
              <option>换货</option>
              <option>退货</option>
              <option>补偿</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            过程记录
            <textarea
              value={draft.processNote ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, processNote: e.target.value })
              }
            />
          </label>
          <label>
            现场照片 / 视频
            <input type="file" multiple accept="image/*,video/*" onChange={async(e)=>setDraft({...draft,onsiteFiles:[...(draft.onsiteFiles??[]),...await readFiles(e.target.files)]})}/>
          </label>
          <FileGallery files={draft.onsiteFiles} />
        </Editable>
        <Editable title="解决情况">
          <label>
            <input
              type="checkbox"
              checked={draft.resolved ?? false}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  resolved: e.target.checked,
                  resolvedAt: e.target.checked
                    ? new Date().toISOString()
                    : undefined,
                  status: e.target.checked ? "已解决" : draft.status,
                })
              }
            />{" "}
            问题已解决
          </label>
          <label>
            解决时间
            <input
              type="datetime-local"
              value={draft.resolvedAt?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, resolvedAt: e.target.value })
              }
            />
          </label>
          <label>
            解决方式
            <input
              value={draft.resolution ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, resolution: e.target.value })
              }
            />
          </label>
          <label>
            客户满意度
            <select
              value={draft.satisfaction ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  satisfaction: e.target
                    .value as AfterSalesTicket["satisfaction"],
                })
              }
            >
              <option value="">待评价</option>
              <option>满意</option>
              <option>一般</option>
              <option>不满意</option>
            </select>
          </label>
          <label>
            客户反馈
            <textarea
              value={draft.customerFeedback ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, customerFeedback: e.target.value })
              }
            />
          </label>
          <label>
            备注
            <textarea
              value={draft.note ?? ""}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
        </Editable>
      </section>
      <section className="ticket-timeline">
        <h2>处理时间线</h2>
        {(
          ticket.timeline ?? [
            {
              id: "created",
              type: "工单创建" as const,
              at: ticket.createdAt,
              operator: ticket.owner,
            },
          ]
        ).map((event) => (
          <article key={event.id}>
            <i />
            <div>
              <b>{event.type}</b>
              <span>
                {event.at.replace("T", " ").slice(0, 16)} · {event.operator}
              </span>
              <small>{event.detail}</small>
            </div>
          </article>
        ))}
      </section>
      <footer>
        <span>保存后会自动写入时间线。</span>
        <button
          onClick={() =>
            save(
              draft.resolved
                ? "解决完成"
                : draft.visitedAt
                  ? "上门处理"
                  : draft.appointmentAt
                    ? "预约上门"
                    : draft.contacted
                      ? "首次联系客户"
                      : "状态变更",
            )
          }
        >
          保存工单更新
        </button>
      </footer>
    </main>
  );
}
function Editable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ticket-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function FileGallery({ files }: { files?: CustomerFile[] }) {
  return files?.length ? (
    <div className="file-gallery">
      {files.map((file) =>
        file.type.startsWith("image/") ? (
          <img src={file.dataUrl} alt={file.name} key={file.id} />
        ) : (
          <span key={file.id}>{file.name}</span>
        ),
      )}
    </div>
  ) : (
    <small>暂无附件</small>
  );
}
