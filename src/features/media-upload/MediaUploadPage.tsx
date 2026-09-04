import { useState } from 'react'
import { salesApi } from '../../api/salesApi'
import type { MediaProductSummary } from '../../api/salesApi'
import type { MediaFile } from '../../types'
import './media-upload.css'

type Kind = 'whiteBg' | 'scene'

interface LocalFile {
  id: string
  name: string
  type: string
  url: string
  size?: number
  uploading?: boolean
  error?: boolean
}

export default function MediaUploadPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<MediaProductSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<MediaProductSummary | null>(null)
  const [whiteBg, setWhiteBg] = useState<LocalFile[]>([])
  const [scene, setScene] = useState<LocalFile[]>([])
  const [busy, setBusy] = useState<Kind | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const search = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const r = await salesApi.listMediaProducts(q.trim())
      setResults(r.products || [])
      if (!(r.products || []).length) setMsg({ type: 'err', text: '没有匹配的产品，换个编码或名称试试' })
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '查询失败' })
    } finally {
      setLoading(false)
    }
  }

  const open = (p: MediaProductSummary) => {
    setSelected(p)
    setWhiteBg([])
    setScene([])
    setMsg(null)
  }

  const pick = async (kind: Kind, files: FileList | null) => {
    if (!files || !files.length || !selected) return
    const arr = Array.from(files)
    const set = kind === 'whiteBg' ? setWhiteBg : setScene
    for (const f of arr) {
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      set(prev => [...prev, { id: tempId, name: f.name, type: f.type || 'image', url: '', size: f.size, uploading: true }])
      try {
        const r = await salesApi.uploadFile(f, selected.id, 'product-media')
        const mf = r.file as unknown as MediaFile
        set(prev => prev.map(item => item.id === tempId
          ? { id: mf.id, name: mf.name, type: mf.type, url: mf.url, size: mf.size, uploading: false }
          : item))
      } catch {
        set(prev => prev.map(item => item.id === tempId ? { ...item, uploading: false, error: true } : item))
      }
    }
  }

  const save = async (kind: Kind) => {
    if (!selected) return
    const list = kind === 'whiteBg' ? whiteBg : scene
    const ready = list.filter(f => !f.uploading && !f.error && f.url)
    if (!ready.length) {
      setMsg({ type: 'err', text: '还没有上传成功的图片' })
      return
    }
    setBusy(kind)
    setMsg(null)
    try {
      const files: MediaFile[] = ready.map(f => ({ id: f.id, name: f.name, type: f.type, url: f.url, size: f.size }))
      const r = await salesApi.attachMediaImages(selected.id, kind, files)
      setMsg({ type: 'ok', text: `已保存 ${ready.length} 张${kind === 'whiteBg' ? '白底图' : '场景图'}` })
      const updated = { ...selected, media: r.product.media }
      setSelected(updated)
      setResults(prev => prev.map(p => (p.id === selected.id ? updated : p)))
      if (kind === 'whiteBg') setWhiteBg([]); else setScene([])
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '保存失败' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="media-upload">
      <header className="mu-header">
        <div>
          <h1>产品图采集台</h1>
          <p>按编码或名称找到产品，上传「白底图」与「场景图」，保存即可同步到目录与详情页。</p>
        </div>
        {selected && (
          <button className="mu-back" onClick={() => setSelected(null)}>← 返回列表</button>
        )}
      </header>

      {msg && (
        <div className={`mu-msg ${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>
      )}

      {!selected ? (
        <section className="mu-search">
          <div className="mu-searchbar">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="输入产品编码或名称，如 SP-CT-001 / 黑胡桃圆餐桌"
            />
            <button onClick={search} disabled={loading}>{loading ? '查询中…' : '搜索'}</button>
          </div>
          <div className="mu-results">
            {results.map(p => (
              <button key={p.id} className="mu-card" onClick={() => open(p)}>
                <div className="mu-card-top">
                  <span className="mu-code">{p.code}</span>
                  <span className="mu-status">{p.status || '上架'}</span>
                </div>
                <div className="mu-name">{p.name}</div>
                <div className="mu-meta">{(p.categoryName || '') + (p.series ? ' · ' + p.series : '')}</div>
                <div className="mu-counts">
                  <span className={p.media.whiteBg ? 'has' : ''}>白底 {p.media.whiteBg}</span>
                  <span className={p.media.scene ? 'has' : ''}>场景 {p.media.scene}</span>
                  <span className={p.media.realShot ? 'has' : ''}>实拍 {p.media.realShot}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="mu-editor">
          <div className="mu-product-head">
            <span className="mu-code">{selected.code}</span>
            <span className="mu-name">{selected.name}</span>
          </div>

          <UploadZone
            title="白底图"
            hint="纯色背景的产品标准照（正面 / 45° / 侧面 / 细节）"
            files={whiteBg}
            busy={busy === 'whiteBg'}
            onPick={files => pick('whiteBg', files)}
            onSave={() => save('whiteBg')}
            onRemove={id => setWhiteBg(prev => prev.filter(f => f.id !== id))}
          />
          <UploadZone
            title="场景图"
            hint="产品在真实 / 模拟空间里的效果（客厅 / 餐厅 / 卧室）"
            files={scene}
            busy={busy === 'scene'}
            onPick={files => pick('scene', files)}
            onSave={() => save('scene')}
            onRemove={id => setScene(prev => prev.filter(f => f.id !== id))}
          />
        </section>
      )}
    </main>
  )
}

function UploadZone({
  title,
  hint,
  files,
  busy,
  onPick,
  onSave,
  onRemove,
}: {
  title: string
  hint: string
  files: LocalFile[]
  busy: boolean
  onPick: (files: FileList | null) => void
  onSave: () => void
  onRemove: (id: string) => void
}) {
  const inputId = `mu-input-${title}`
  return (
    <div className="mu-zone">
      <div className="mu-zone-head">
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <button className="mu-save" onClick={onSave} disabled={busy || !files.some(f => !f.uploading && !f.error)}>
          {busy ? '保存中…' : '保存到产品'}
        </button>
      </div>
      <label htmlFor={inputId} className="mu-drop">
        <span>＋ 点击选择图片（可多选）</span>
        <input id={inputId} type="file" accept="image/*" multiple hidden onChange={e => { onPick(e.target.files); e.target.value = '' }} />
      </label>
      <div className="mu-thumbs">
        {files.map(f => (
          <div key={f.id} className={`mu-thumb ${f.uploading ? 'uploading' : ''} ${f.error ? 'error' : ''}`}>
            {f.url ? <img src={f.url} alt={f.name} /> : <div className="mu-thumb-ph" />}
            <span className="mu-thumb-name">{f.uploading ? '上传中…' : f.error ? '失败' : f.name}</span>
            {!f.uploading && (
              <button className="mu-thumb-x" onClick={() => onRemove(f.id)}>×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
