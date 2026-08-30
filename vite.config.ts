import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/shangpinju-sales-crm/' : '/',
  plugins: [react()],
  // 局域网/虚拟局域网访问：监听所有网卡；/api 代理到本机 3001（外部设备用 IP 打开页面时 API 仍可用）
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
    watch: {
      ignored: [
        'server/data/**',
        'backups/**',
        '**/*.sqlite',
        '**/*.sqlite-*',
      ],
    },
  },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{ts,tsx}'] },
}))
