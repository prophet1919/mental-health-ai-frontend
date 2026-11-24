import request from '@/utils/request'

/** 创建空会话，返回 { sessionId, ... } */
export const startSession = (data = {}) => request.post('/api/psychological-chat/session/start', data)

/** 会话列表 */
export const listSessions = (params) => request.get('/api/psychological-chat/sessions', { params })

/** 会话详情 */
export const getSession = (sessionId) => request.get(`/api/psychological-chat/sessions/${sessionId}`)

/** 消息分页 */
export const listMessages = (sessionId, params) =>
    request.get(`/api/psychological-chat/sessions/${sessionId}/messages`, { params })
