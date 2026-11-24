import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'), //dirname为当前目录
    },
  },
  server: {
    port: 5173,
    // 开发代理：把 /api 请求转发到后端，避免浏览器跨域预检。
    // 即使后端 CORS 配置有问题，走代理也能正常联调；
    // 生产环境由 Nginx 做同样的转发。
    proxy: {
      '/api': {
        target: 'http://localhost:1236',
        changeOrigin: true,
      },
    },
  },
})
