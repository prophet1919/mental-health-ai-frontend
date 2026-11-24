import request from '@/utils/request'

/** 登录：username 可为用户名或邮箱 */
export const login = (data) => request.post('/api/user/login', data)

/** 注册 */
export const register = (data) => request.post('/api/user/add', data)

/** 当前用户详情 */
export const getCurrentUser = () => request.get('/api/user/current')

/** 健康检查（无需鉴权） */
export const health = () => request.get('/api/health')
