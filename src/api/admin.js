import request from '@/utils/request'

/** 管理端：全部会话列表 */
export const listAllSessions = (params) => request.get('/api/admin/consultations', { params })

/** 管理端：会话详情 */
export const getSessionDetail = (sessionId) => request.get(`/api/admin/consultations/${sessionId}`)

/** 管理端：会话消息 */
export const getSessionMessages = (sessionId, params) =>
    request.get(`/api/admin/consultations/${sessionId}/messages`, { params })
