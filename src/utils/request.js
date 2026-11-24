import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

/**
 * 统一请求封装。
 * - 统一携带 Authorization: Bearer <token>
 * - 统一解包 { code, msg, data }
 * - 401 自动登出并跳登录页
 */
const request = axios.create({
    // 相对路径：开发时由 vite 代理转发到 1236，生产时由 Nginx 转发。
    // 这样浏览器看到的始终是同源请求，不会触发跨域预检。
    baseURL: import.meta.env.VITE_API_BASE || '',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
})

request.interceptors.request.use((config) => {
    const auth = useAuthStore()
    if (auth.token) {
        config.headers.Authorization = `Bearer ${auth.token}`
    }
    return config
})

request.interceptors.response.use(
    (response) => {
        const body = response.data
        // 非标准响应（如文件流）直接返回
        if (body == null || typeof body !== 'object' || !('code' in body)) {
            return body
        }
        if (body.code === '200') {
            return body.data
        }
        // 业务错误：统一提示并抛出，调用方可用 try/catch 处理
        const message = body.msg || '请求失败'
        ElMessage.error(message)
        const error = new Error(message)
        error.code = body.code
        error.data = body.data
        return Promise.reject(error)
    },
    (error) => {
        const status = error.response?.status
        const body = error.response?.data
        const message = body?.msg || error.message || '网络异常'

        if (status === 401) {
            const auth = useAuthStore()
            auth.clear()
            if (router.currentRoute.value.path !== '/login') {
                ElMessage.warning('登录已过期，请重新登录')
                router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
            }
        } else if (status === 403) {
            ElMessage.error('没有访问权限')
        } else {
            ElMessage.error(message)
        }
        return Promise.reject(error)
    }
)

export default request
