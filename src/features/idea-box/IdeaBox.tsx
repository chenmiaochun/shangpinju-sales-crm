import { useCallback, useMemo, useState } from 'react'
import { Lightbulb, Send, X } from 'lucide-react'
import { IDEA_MODULES, IDEA_STATUSES, salesApi, type RemoteIdea } from '../../api/salesApi'
import { useAuth } from '../../auth/AuthContext'

const DEFAULT_MODULE = IDEA_MODULES[IDEA_MODULES.length - 1]

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 常驻在右下角的「记一笔」。
 * 任何登录的人都可以在用系统的当下，把想改的地方一句话记下来；
 * 店长还能切到「全部」看列表、改状态。
 */
export function IdeaBox() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'submit' | 'list'>('submit')
  const [content, setContent] = useState('')
  const [module, setModule] = useState<string>(DEFAULT_MODULE)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [ideas, setIdeas] = useState<RemoteIdea[]>([])

  const isManager = useMemo(() => {
    if (!user) return false
    const roles = user.roles?.length ? user.roles : [user.role]
    return roles.includes('manager')
  }, [user])

  const loadIdeas = useCallback(async () => {
    setBusy(true)
    try {
      const result = await salesApi.listIdeas()
      setIdeas(result.ideas)
    } catch {
      setNotice('列表加载失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }, [])

  const openPanel = (next: 'submit' | 'list') => {
    setTab(next)
    setOpen(true)
    setNotice('')
    if (next === 'list') void loadIdeas()
  }

  const submit = async () => {
    const text = content.trim()
    if (!text) {
      setNotice('先写一句你想改什么')
      return
    }
    setBusy(true)
    setNotice('')
    try {
      await salesApi.createIdea({ content: text, module })
      setContent('')
      setNotice('记下了，谢谢！')
    } catch {
      setNotice('提交失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (idea: RemoteIdea, status: string) => {
    setBusy(true)
    try {
      const result = await salesApi.updateIdea(idea.id, { status })
      setIdeas((current) => current.map((item) => (item.id === idea.id ? result.idea : item)))
    } catch {
      setNotice('更新失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="idea-box">
      {open && (
        <section className="idea-panel" aria-label="记一笔">
          <header className="idea-panel-head">
            <strong>记一笔</strong>
            <button type="button" className="idea-close" onClick={() => setOpen(false)} aria-label="关闭记一笔">
              <X size={16} />
            </button>
          </header>

          {isManager && (
            <nav className="idea-tabs">
              <button
                type="button"
                className={tab === 'submit' ? 'is-active' : ''}
                onClick={() => openPanel('submit')}
              >
                提想法
              </button>
              <button
                type="button"
                className={tab === 'list' ? 'is-active' : ''}
                onClick={() => openPanel('list')}
              >
                全部 {ideas.length ? `(${ideas.length})` : ''}
              </button>
            </nav>
          )}

          {tab === 'submit' ? (
            <div className="idea-body">
              <label className="idea-label" htmlFor="idea-content">
                想改什么、哪里不顺手，写一句就行
              </label>
              <textarea
                id="idea-content"
                className="idea-textarea"
                rows={4}
                maxLength={1000}
                value={content}
                placeholder="例如：报价单的折扣希望能手工改"
                onChange={(event) => setContent(event.target.value)}
              />
              <label className="idea-label" htmlFor="idea-module">
                属于哪一块
              </label>
              <select
                id="idea-module"
                className="idea-select"
                value={module}
                onChange={(event) => setModule(event.target.value)}
              >
                {IDEA_MODULES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button type="button" className="idea-submit" onClick={() => void submit()} disabled={busy}>
                <Send size={15} />
                <span>{busy ? '提交中…' : '提交'}</span>
              </button>
            </div>
          ) : (
            <div className="idea-body idea-list">
              {!ideas.length && <p className="idea-empty">还没有人提过想法</p>}
              {ideas.map((idea) => (
                <article key={idea.id} className="idea-item">
                  <p className="idea-item-content">{idea.content}</p>
                  <div className="idea-item-meta">
                    <span className="idea-chip">{idea.module}</span>
                    <span>{idea.authorName || '匿名'}</span>
                    <span>{formatTime(idea.createdAt)}</span>
                  </div>
                  <select
                    className="idea-select idea-status"
                    value={idea.status}
                    onChange={(event) => void changeStatus(idea, event.target.value)}
                    aria-label={`${idea.content} 的处理状态`}
                  >
                    {IDEA_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          )}

          {notice && <p className="idea-notice">{notice}</p>}
        </section>
      )}

      <button
        type="button"
        className={`idea-fab${open ? ' is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openPanel('submit'))}
        aria-label="记一笔"
        aria-expanded={open}
      >
        <Lightbulb size={19} />
        <span>记一笔</span>
      </button>
    </div>
  )
}
