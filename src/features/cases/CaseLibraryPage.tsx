import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  EyeOff,
  Eye,
  Loader2,
  Package,
  Search,
  Trash2,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CASE_CATEGORIES, salesApi, type RemoteCase } from "../../api/salesApi";
import { useAuth } from "../../auth/AuthContext";
import { useSalesData } from "../../store/SalesDataContext";
import { MediaUploader } from "../product-master/MediaUploader";
import type { MediaFile } from "../../types";
import "./cases.css";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 案例库：员工上传图片和案例的统一入口。
 * 任何登录员工都能上传（图片先进 uploads，案例存 SQLite cases 表），
 * 全员可见；修改/删除限上传者本人或店长。
 */
export function CaseLibraryPage() {
  const { user } = useAuth();
  const sales = useSalesData();

  const [cases, setCases] = useState<RemoteCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CASE_CATEGORIES[0]);
  const [productText, setProductText] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<MediaFile[]>([]);
  const [busy, setBusy] = useState(false);

  const [filterCategory, setFilterCategory] = useState<string>("全部");
  const [keyword, setKeyword] = useState("");

  const [viewer, setViewer] = useState<{ caseIndex: number; imageIndex: number } | null>(null);

  const isManager = useMemo(() => {
    if (!user) return false;
    const roles = user.roles?.length ? user.roles : [user.role];
    return roles.includes("manager");
  }, [user]);

  const productNameOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of sales.configProducts ?? []) {
      if (item.name) names.add(item.name);
    }
    for (const item of sales.products ?? []) {
      if (item.name) names.add(item.name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "zh")).slice(0, 400);
  }, [sales.configProducts, sales.products]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const result = await salesApi.listCases();
      setCases(result.cases);
    } catch {
      setNotice("案例加载失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCases() }, [loadCases]);

  // 键盘左右切换看图
  useEffect(() => {
    if (!viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewer(null);
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const current = cases[viewer.caseIndex];
      const total = current?.images?.length ?? 0;
      if (!total) return;
      setViewer(prev => prev ? { ...prev, imageIndex: (prev.imageIndex + (event.key === "ArrowRight" ? 1 : total - 1)) % total } : prev)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [viewer, cases])

  const visibleCases = useMemo(() => {
    let list = isManager ? cases : cases.filter((item) => item.status !== "已隐藏")
    if (filterCategory !== "全部") list = list.filter((item) => item.category === filterCategory)
    const query = keyword.trim().toLowerCase()
    if (query) {
      list = list.filter((item) =>
        [item.title, item.authorName, item.customerName, item.note, ...(item.productNames ?? [])]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(query)),
      )
    }
    return list
  }, [cases, isManager, filterCategory, keyword])

  const canManage = (item: RemoteCase) => isManager || (user?.name && item.authorName === user.name)

  const resetForm = () => {
    setTitle("")
    setCategory(CASE_CATEGORIES[0])
    setProductText("")
    setCustomerName("")
    setNote("")
    setImages([])
  }

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed) { setNotice("请填写案例标题"); return }
    if (!images.length) { setNotice("请至少上传一张图片"); return }
    setBusy(true)
    setNotice("")
    try {
      const productNames = productText.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean)
      await salesApi.createCase({ title: trimmed, category, productNames, customerName: customerName.trim(), note: note.trim(), images: images.map(({ id, name, type, url, size }) => ({ id, name, type, url, size })) })
      resetForm()
      setFormOpen(false)
      setNotice("已上传，全员可见")
      await loadCases()
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败，请稍后再试"
      setNotice(message.includes("401") ? "登录已过期，请重新登录" : `上传失败：${message}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (item: RemoteCase) => {
    try {
      const next = item.status === "已隐藏" ? "已发布" : "已隐藏"
      await salesApi.updateCase(item.id, { status: next })
      setCases(prev => prev.map(entry => entry.id === item.id ? { ...entry, status: next } : entry))
    } catch { setNotice("操作失败，请稍后再试") }
  }

  const removeCase = async (item: RemoteCase) => {
    if (!window.confirm(`确定删除「${item.title}」吗？图片文件会保留在服务器，案例记录将删除。`)) return
    try {
      await salesApi.deleteCase(item.id)
      setCases(prev => prev.filter((entry) => entry.id !== item.id))
    } catch { setNotice("删除失败，请稍后再试") }
  }

  const openViewer = (caseIndex: number, imageIndex: number) => setViewer({ caseIndex, imageIndex })

  const viewerCase = viewer ? visibleCases[viewer.caseIndex] : null

  return (
    <main className="cl-page">
      <header className="cl-head">
        <p>尚品居经营工作台</p>
        <h1>案例库</h1>
        <span>员工上传图片与案例的统一入口 · 上传后立即入库、全员可见 · 修改/删除限本人或店长</span>
      </header>

      <div className="cl-toolbar">
        <button type="button" className="cl-primary-btn" onClick={() => setFormOpen(prev => !prev)}>
          <Upload size={16} />
          {formOpen ? "收起上传表单" : "上传图片 / 案例"}
        </button>
        <div className="cl-filter">
          <div className="cl-search">
            <Search size={15} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题 / 产品 / 客户 / 上传人"
            />
            {keyword && (
              <button type="button" aria-label="清空搜索" onClick={() => setKeyword("")}><X size={14} /></button>
            )}
          </div>
          <div className="cl-category-chips">
            {["全部", ...CASE_CATEGORIES].map((item) => (
              <button
                key={item}
                type="button"
                className={filterCategory === item ? "active" : ""}
                onClick={() => setFilterCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && <p className="cl-notice" onClick={() => setNotice("")}>{notice}</p>}

      {formOpen && (
        <section className="cl-form">
          <h2>新案例</h2>
          <div className="cl-form-grid">
            <label className="cl-field cl-field-wide">
              <span>标题 *</span>
              <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="例：深圳湾客户客厅全案交付" />
            </label>
            <label className="cl-field">
              <span>分类</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CASE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="cl-field">
              <span>客户（建议脱敏，选填）</span>
              <input value={customerName} maxLength={60} onChange={(event) => setCustomerName(event.target.value)} placeholder="例：李先生 / 南山客户" />
            </label>
            <label className="cl-field cl-field-wide">
              <span>关联产品（逗号分隔，选填）</span>
              <input
                list="cl-product-options"
                value={productText}
                onChange={(event) => setProductText(event.target.value)}
                placeholder="例：云朵沙发, 云朵茶几"
              />
              <datalist id="cl-product-options">
                {productNameOptions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
            <label className="cl-field cl-field-wide">
              <span>备注（选填）</span>
              <textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例：交付时间、客户反馈、搭配思路……" />
            </label>
          </div>
          <MediaUploader
            value={images}
            onChange={setImages}
            ownerId={user?.id || "case-library"}
            label="案例图片 *（可多张，第一张为封面）"
            accept="image/*"
            hint="支持 jpg / png / webp 等，单张最大 20MB"
          />
          <div className="cl-form-actions">
            <button type="button" className="cl-primary-btn" onClick={submit} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
              {busy ? "上传中…" : "提交案例"}
            </button>
            <button type="button" className="cl-ghost-btn" onClick={() => { resetForm(); setFormOpen(false) }}>取消</button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="cl-empty">加载中…</p>
      ) : visibleCases.length === 0 ? (
        <div className="cl-empty">
          <Camera size={34} />
          <p>{keyword || filterCategory !== "全部" ? "没有匹配的案例" : "还没有案例，点上方「上传图片 / 案例」传第一个"}</p>
        </div>
      ) : (
        <div className="cl-grid">
          {visibleCases.map((item, caseIndex) => (
            <article key={item.id} className={`cl-card${item.status === "已隐藏" ? " is-hidden" : ""}`}>
              <div className="cl-card-cover" onClick={() => item.images?.length && openViewer(caseIndex, 0)}>
                {item.images?.length ? (
                  <img src={item.images[0].url} alt={item.images[0].name} loading="lazy" />
                ) : (
                  <div className="cl-cover-fallback"><Package size={22} /></div>
                )}
                {item.images?.length > 1 && <span className="cl-count">{item.images.length} 图</span>}
                <span className="cl-badge">{item.category}</span>
                {item.status === "已隐藏" && <span className="cl-badge cl-badge-muted">已隐藏</span>}
              </div>
              <div className="cl-card-body">
                <h3>{item.title}</h3>
                {item.customerName && <p className="cl-meta">客户：{item.customerName}</p>}
                {item.productNames?.length > 0 && (
                  <p className="cl-products">
                    {item.productNames.map((name) => <span key={name}>{name}</span>)}
                  </p>
                )}
                {item.note && <p className="cl-note">{item.note}</p>}
                <footer>
                  <span>{item.authorName || item.author} · {formatTime(item.createdAt)}</span>
                  {canManage(item) && (
                    <span className="cl-card-actions">
                      {isManager && (
                        <button type="button" title={item.status === "已隐藏" ? "恢复展示" : "隐藏"} onClick={() => toggleStatus(item)}>
                          {item.status === "已隐藏" ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      <button type="button" title="删除" onClick={() => removeCase(item)}><Trash2 size={14} /></button>
                    </span>
                  )}
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}

      {viewerCase && viewer && (
        <div className="cl-viewer" onClick={() => setViewer(null)}>
          <div className="cl-viewer-body" onClick={(event) => event.stopPropagation()}>
            <img
              src={viewerCase.images[viewer.imageIndex]?.url}
              alt={viewerCase.images[viewer.imageIndex]?.name}
              onClick={(event) => event.stopPropagation()}
            />
            <div className="cl-viewer-info" onClick={(event) => event.stopPropagation()}>
              <strong>{viewerCase.title}</strong>
              <span>{viewer.imageIndex + 1} / {viewerCase.images.length} · {viewerCase.category}{viewerCase.customerName ? ` · ${viewerCase.customerName}` : ""}</span>
            </div>
            <button type="button" className="cl-viewer-close" onClick={() => setViewer(null)}><X size={18} /></button>
            {viewerCase.images.length > 1 && (
              <>
                <button
                  type="button"
                  className="cl-viewer-nav prev"
                  onClick={(event) => { event.stopPropagation(); const total = viewerCase.images.length; setViewer({ ...viewer, imageIndex: (viewer.imageIndex + total - 1) % total }) }}
                ><ChevronLeft size={20} /></button>
                <button
                  type="button"
                  className="cl-viewer-nav next"
                  onClick={(event) => { event.stopPropagation(); const total = viewerCase.images.length; setViewer({ ...viewer, imageIndex: (viewer.imageIndex + 1) % total }) }}
                ><ChevronRight size={20} /></button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
