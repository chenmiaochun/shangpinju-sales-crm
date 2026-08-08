import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('尚品居系统页面异常', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="system-error"><div><strong>页面暂时无法显示</strong><p>数据没有被删除，请刷新页面重试；如果仍然出现，请截图联系店长。</p><button type="button" onClick={() => window.location.reload()}>刷新页面</button><a href="#/leads">返回线索数据</a></div></main>
  }
}
