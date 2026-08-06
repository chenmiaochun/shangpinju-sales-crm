import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/salesApi'
import { useAuth } from './AuthContext'
import './auth.css'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => () => auth.clearNotice(), [])
  if (auth.status === 'authenticated') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/dashboard'} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) { setError('请输入账号和密码'); return }
    setSubmitting(true); setError('')
    try {
      await auth.login(username.trim(), password)
      navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 429 ? '尝试次数过多，请稍后再试' : '账号或密码不正确')
    } finally { setSubmitting(false) }
  }

  return <main className="login-page">
    <section className="login-brand"><div className="login-brand-mark">尚</div><p>尚品居原创家具</p><h1>经营工作台</h1><span>客户、销售、库存、交付一体化管理。</span></section>
    <section className="login-panel" aria-labelledby="login-title">
      <form onSubmit={submit}>
        <header><small>安全登录</small><h2 id="login-title">欢迎回来</h2><p>使用店长分配的账号登录系统</p></header>
        {auth.notice && <div className="login-notice" role="status">{auth.notice}</div>}
        <label><span>账号</span><div className="login-input"><UserRound size={18} /><input autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入账号" /></div></label>
        <label><span>密码</span><div className="login-input"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" /><button type="button" onClick={() => setShowPassword((value) => !value)} title={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" disabled={submitting}>{submitting && <LoaderCircle size={18} className="spin" />}{submitting ? '正在登录' : '登录'}</button>
        <footer>账号无法登录时，请联系店长重置密码</footer>
      </form>
    </section>
  </main>
}
