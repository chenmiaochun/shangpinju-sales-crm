import { useMemo, useState } from "react";
import { Plus, Trash2, Layers, Boxes, FolderTree, FolderInput } from "lucide-react";
import type {
  ComponentSpecDim,
  ProductCategory,
  ProductComponent,
  ProductSeries,
} from "../../../types";
import { useSalesData } from "../../../store/SalesDataContext";
import {
  bySort,
  newId,
  PUBLIC_SERIES_ID,
  seriesIdOf,
  seriesListOf,
} from "../pm-utils";

export function CategoryComponentTab() {
  const sales = useSalesData();
  const categories = sales.categories ?? [];
  const series = sales.series ?? [];
  const components = sales.components ?? [];

  const [addingCategory, setAddingCategory] = useState(false);
  const [catName, setCatName] = useState("");
  const [catCode, setCatCode] = useState("");
  const [catSort, setCatSort] = useState(0);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(PUBLIC_SERIES_ID);

  const [addingSeries, setAddingSeries] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [seriesSort, setSeriesSort] = useState(0);

  const [addingComponent, setAddingComponent] = useState(false);
  const [compName, setCompName] = useState("");
  const [compCode, setCompCode] = useState("");
  const [compSort, setCompSort] = useState(0);
  const [compSeriesId, setCompSeriesId] = useState<string>(PUBLIC_SERIES_ID);
  const [dimRows, setDimRows] = useState<{ name: string; values: string }[]>([
    { name: "", values: "" },
  ]);

  // 批量迁移主件
  const [migrating, setMigrating] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [moveTarget, setMoveTarget] = useState<string>(PUBLIC_SERIES_ID);

  const [catNotice, setCatNotice] = useState("");
  const [seriesNotice, setSeriesNotice] = useState("");
  const [compNotice, setCompNotice] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort(bySort),
    [categories],
  );
  const selectedCategory =
    categories.find((c) => c.id === selectedCategoryId) ?? sortedCategories[0];
  const categoryId = selectedCategory?.id ?? "";

  // 当前大类下的系列列表（公共/其他 + 真实系列）
  const seriesList = useMemo(
    () => seriesListOf(categoryId, series),
    [categoryId, series],
  );
  const selectedSeries =
    seriesList.find((s) => s.id === selectedSeriesId) ?? seriesList[0];
  const activeSeriesId = selectedSeries?.id ?? PUBLIC_SERIES_ID;

  // 当前大类 + 系列下的主件（seriesId 为空 = 公共/其他）
  const categoryComponents = useMemo(
    () =>
      components
        .filter(
          (c) => c.categoryId === categoryId && seriesIdOf(c) === activeSeriesId,
        )
        .sort(bySort),
    [components, categoryId, activeSeriesId],
  );

  function submitCategory() {
    if (!catName.trim() || !catCode.trim()) {
      setCatNotice("请填写名称和代码");
      return;
    }
    setCatNotice("");
    const item: ProductCategory = {
      id: newId(),
      name: catName.trim(),
      code: catCode.trim().toUpperCase(),
      sort: catSort,
    };
    sales.addProductMaster("categories", item);
    setCatName("");
    setCatCode("");
    setCatSort(0);
    setAddingCategory(false);
    if (!selectedCategoryId) {
      setSelectedCategoryId(item.id);
      setSelectedSeriesId(PUBLIC_SERIES_ID);
    }
  }

  function submitSeries() {
    if (!seriesName.trim() || !categoryId) {
      setSeriesNotice("请选择大类并填写系列名称");
      return;
    }
    setSeriesNotice("");
    const item: ProductSeries = {
      id: newId(),
      categoryId,
      name: seriesName.trim(),
      sort: seriesSort,
    };
    sales.addProductMaster("series", item);
    setSeriesName("");
    setSeriesSort(0);
    setAddingSeries(false);
    setSelectedSeriesId(item.id);
  }

  function deleteSeries(ser: ProductSeries) {
    const count = components.filter(
      (c) => c.categoryId === categoryId && seriesIdOf(c) === ser.id,
    ).length;
    if (
      confirm(
        `确认删除系列「${ser.name}」？${count ? `其下 ${count} 个主件将归入「公共/其他」。` : ""}`,
      )
    ) {
      if (count) sales.moveComponentsToSeries(components
        .filter((c) => c.categoryId === categoryId && seriesIdOf(c) === ser.id)
        .map((c) => c.id), undefined);
      sales.removeProductMaster("series", ser.id);
      if (selectedSeriesId === ser.id) setSelectedSeriesId(PUBLIC_SERIES_ID);
    }
  }

  function submitComponent() {
    if (!compName.trim() || !compCode.trim() || !categoryId) {
      setCompNotice("请选择所属大类，并填写名称和代码");
      return;
    }
    if (!compSeriesId) {
      setCompNotice("请选择归属产品系列");
      return;
    }
    setCompNotice("");
    const specDims: ComponentSpecDim[] = dimRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: newId(),
        name: r.name.trim(),
        values: r.values
          .split(/[,，\n]/)
          .map((v) => v.trim())
          .filter(Boolean),
      }));
    const item: ProductComponent = {
      id: newId(),
      categoryId,
      // 公共/其他为虚拟系列，不落库（seriesId 为空即公共/其他）
      seriesId:
        compSeriesId && compSeriesId !== PUBLIC_SERIES_ID
          ? compSeriesId
          : undefined,
      code: compCode.trim().toUpperCase(),
      name: compName.trim(),
      sort: compSort,
      specDims,
    };
    sales.addProductMaster("components", item);
    setCompName("");
    setCompCode("");
    setCompSort(0);
    setDimRows([{ name: "", values: "" }]);
    setAddingComponent(false);
  }

  function updateComponentSpecs(comp: ProductComponent) {
    const specDims: ComponentSpecDim[] = dimRows
      .filter((r) => r.name.trim())
      .map((r, idx) => ({
        id: comp.specDims[idx]?.id ?? newId(),
        name: r.name.trim(),
        values: r.values
          .split(/[,，\n]/)
          .map((v) => v.trim())
          .filter(Boolean),
      }));
    sales.updateProductMaster("components", comp.id, { specDims });
    setDimRows([{ name: "", values: "" }]);
  }

  function toggleMoveId(id: string) {
    setMoveIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  function confirmMove() {
    if (!moveIds.length) return;
    sales.moveComponentsToSeries(
      moveIds,
      moveTarget === PUBLIC_SERIES_ID ? undefined : moveTarget,
    );
    setMoveIds([]);
    setMigrating(false);
  }

  return (
    <div className="pm-three-col">
      {/* 第一栏：大类 */}
      <section className="pm-col">
        <header className="pm-col-head">
          <h3>
            <Layers size={16} /> 大类
          </h3>
          <button className="pm-add" onClick={() => { setAddingCategory((v) => !v); setCatNotice(""); }}>
            <Plus size={15} /> 新增大类
          </button>
        </header>
        {addingCategory && (
          <div className="pm-inline-form">
            {catNotice && (
              <div className="pm-notice" role="alert">{catNotice}</div>
            )}
            <label>
              名称
              <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="如 餐桌类" />
            </label>
            <label>
              代码
              <input value={catCode} onChange={(e) => setCatCode(e.target.value)} placeholder="如 CT" />
            </label>
            <label>
              排序
              <input type="number" value={catSort} onChange={(e) => setCatSort(Number(e.target.value))} />
            </label>
            <div className="pm-form-actions">
              <button className="pm-primary" onClick={submitCategory}>
                保存
              </button>
              <button onClick={() => { setAddingCategory(false); setCatNotice(""); }}>取消</button>
            </div>
          </div>
        )}
        <ul className="pm-list">
          {sortedCategories.map((cat) => (
            <li
              key={cat.id}
              className={cat.id === categoryId ? "active" : ""}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setSelectedSeriesId(PUBLIC_SERIES_ID);
                setMigrating(false);
                setMoveIds([]);
              }}
            >
              <div>
                <b>{cat.name}</b>
                <small>
                  {cat.code} · {components.filter((c) => c.categoryId === cat.id).length} 个主件
                </small>
              </div>
              <button
                className="pm-del"
                aria-label={`删除 ${cat.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确认删除大类「${cat.name}」？其下主件将一并删除。`)) {
                    components
                      .filter((c) => c.categoryId === cat.id)
                      .forEach((c) => sales.removeProductMaster("components", c.id));
                    series
                      .filter((s) => s.categoryId === cat.id)
                      .forEach((s) => sales.removeProductMaster("series", s.id));
                    sales.removeProductMaster("categories", cat.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {sortedCategories.length === 0 && (
            <li className="pm-empty">暂无大类，先点击「新增大类」。</li>
          )}
        </ul>
      </section>

      {/* 第二栏：产品系列 */}
      <section className="pm-col">
        <header className="pm-col-head">
          <h3>
            <FolderTree size={16} /> 产品系列
            {selectedCategory && <small>（{selectedCategory.name}）</small>}
          </h3>
          <button
            className="pm-add"
            disabled={!categoryId}
            onClick={() => { setAddingSeries((v) => !v); setSeriesNotice(""); }}
          >
            <Plus size={15} /> 新增系列
          </button>
        </header>
        {addingSeries && (
          <div className="pm-inline-form">
            {seriesNotice && (
              <div className="pm-notice" role="alert">{seriesNotice}</div>
            )}
            <label>
              系列名称
              <input value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder="如 五福系列" />
            </label>
            <label>
              排序
              <input type="number" value={seriesSort} onChange={(e) => setSeriesSort(Number(e.target.value))} />
            </label>
            <div className="pm-form-actions">
              <button className="pm-primary" onClick={submitSeries}>
                保存
              </button>
              <button onClick={() => { setAddingSeries(false); setSeriesNotice(""); }}>取消</button>
            </div>
          </div>
        )}
        <ul className="pm-list">
          {seriesList.map((ser) => (
            <li
              key={ser.id}
              className={ser.id === activeSeriesId ? "active" : ""}
              onClick={() => {
                setSelectedSeriesId(ser.id);
                setMigrating(false);
                setMoveIds([]);
              }}
            >
              <div>
                <b>{ser.name}</b>
                <small>
                  {ser.builtin
                    ? "内置 · 存放通用配件"
                    : `${components.filter((c) => c.categoryId === categoryId && seriesIdOf(c) === ser.id).length} 个主件`}
                </small>
              </div>
              {!ser.builtin && (
                <button
                  className="pm-del"
                  aria-label={`删除 ${ser.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSeries(ser);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
          {seriesList.length === 1 && (
            <li className="pm-empty">该大类下暂无自定义系列，可点击「新增系列」。</li>
          )}
        </ul>
      </section>

      {/* 第三栏：主件列表 */}
      <section className="pm-col">
        <header className="pm-col-head">
          <h3>
            <Boxes size={16} /> 主件
            {selectedCategory && (
              <small>
                {selectedCategory.name} / {selectedSeries?.name}
              </small>
            )}
          </h3>
          <div className="pm-col-actions">
            {categoryComponents.length > 0 && !migrating && (
              <button className="pm-add" onClick={() => setMigrating(true)}>
                <FolderInput size={15} /> 批量迁移
              </button>
            )}
            <button
              className="pm-add"
              disabled={!categoryId}
              onClick={() => {
                setAddingComponent((v) => !v);
                setCompNotice("");
                setCompSeriesId(activeSeriesId);
              }}
            >
              <Plus size={15} /> 新增主件
            </button>
          </div>
        </header>
        {addingComponent && (
          <div className="pm-inline-form">
            {compNotice && (
              <div className="pm-notice" role="alert">{compNotice}</div>
            )}
            <label>
              归属产品系列
              <select
                value={compSeriesId}
                onChange={(e) => setCompSeriesId(e.target.value)}
              >
                {seriesList.map((ser) => (
                  <option key={ser.id} value={ser.id}>
                    {ser.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              名称
              <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="如 五福框架" />
            </label>
            <label>
              代码
              <input value={compCode} onChange={(e) => setCompCode(e.target.value)} placeholder="如 WFKJ" />
            </label>
            <label>
              排序
              <input type="number" value={compSort} onChange={(e) => setCompSort(Number(e.target.value))} />
            </label>
            <div className="pm-dims">
              <span>规格维度（每行一个维度，取值用逗号分隔）</span>
              {dimRows.map((row, i) => (
                <div className="pm-dim-row" key={i}>
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setDimRows((rows) =>
                        rows.map((r, j) =>
                          j === i ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="维度名，如 尺寸"
                  />
                  <input
                    value={row.values}
                    onChange={(e) =>
                      setDimRows((rows) =>
                        rows.map((r, j) =>
                          j === i ? { ...r, values: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="取值，如 1.6m,1.8m"
                  />
                  <button
                    onClick={() =>
                      setDimRows((rows) =>
                        rows.length > 1 ? rows.filter((_, j) => j !== i) : rows,
                      )
                    }
                  >
                    删
                  </button>
                </div>
              ))}
              <button
                className="pm-add-mini"
                onClick={() => setDimRows((rows) => [...rows, { name: "", values: "" }])}
              >
                + 加维度
              </button>
            </div>
            <div className="pm-form-actions">
              <button className="pm-primary" onClick={submitComponent}>
                保存
              </button>
              <button onClick={() => { setAddingComponent(false); setCompNotice(""); }}>取消</button>
            </div>
          </div>
        )}
        <ul className="pm-list">
          {categoryComponents.map((comp) => (
            <li key={comp.id}>
              {migrating && (
                <input
                  type="checkbox"
                  className="pm-check"
                  checked={moveIds.includes(comp.id)}
                  onChange={() => toggleMoveId(comp.id)}
                  aria-label={`选择 ${comp.name}`}
                />
              )}
              <div>
                <b>{comp.name}</b>
                <small>
                  {comp.code} · 排序 {comp.sort}
                </small>
                {comp.specDims.length > 0 && (
                  <div className="pm-specs">
                    {comp.specDims.map((d) => (
                      <span key={d.id} className="pm-spec-chip">
                        {d.name}：{d.values.join(" / ") || "（无取值）"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="pm-row-actions">
                <button
                  className="pm-link"
                  onClick={() => {
                    setDimRows(
                      comp.specDims.length
                        ? comp.specDims.map((d) => ({
                            name: d.name,
                            values: d.values.join(","),
                          }))
                        : [{ name: "", values: "" }],
                    );
                    updateComponentSpecs(comp);
                  }}
                >
                  重设维度
                </button>
                <button
                  className="pm-del"
                  aria-label={`删除 ${comp.name}`}
                  onClick={() => {
                    if (confirm(`确认删除主件「${comp.name}」？`))
                      sales.removeProductMaster("components", comp.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          {categoryComponents.length === 0 && (
            <li className="pm-empty">
              {migrating
                ? "该系列下暂无主件可迁移。"
                : "该系列下暂无主件，点击「新增主件」。"}
            </li>
          )}
        </ul>
        {migrating && (
          <div className="pm-migrate-bar">
            <span>
              已选 <b>{moveIds.length}</b> 个主件，迁至：
            </span>
            <select
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
            >
              {seriesList.map((ser) => (
                <option key={ser.id} value={ser.id}>
                  {ser.name}
                </option>
              ))}
            </select>
            <button
              className="pm-primary"
              disabled={!moveIds.length}
              onClick={confirmMove}
            >
              确认迁移
            </button>
            <button
              onClick={() => {
                setMigrating(false);
                setMoveIds([]);
              }}
            >
              取消
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
