import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useAuthStore } from '@/stores/auth'

// SSE 走同样的相对路径策略：开发时由 vite 代理转发，避免跨域预检
const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * 发起流式对话。
 * <p>
 * 关键点：对话接口非幂等（每次调用都会写用户消息 + 消耗模型额度），
 * 因此必须禁用 fetch-event-source 的自动重连，否则一次失败会重复落库并重复计费。
 *
 * @param {object}   opts
 * @param {string}   opts.sessionId  形如 session_12
 * @param {string}   opts.message    用户本轮输入
 * @param {function} opts.onThinking 收到 thinking 事件（模型推理中）
 * @param {function} opts.onDelta    收到正文片段，参数为字符串
 * @param {function} opts.onDone     正常结束
 * @param {function} opts.onError    失败，参数为 { code, msg }
 * @param {AbortSignal} opts.signal  用于中断
 */
export function streamChat({ sessionId, message, onThinking, onDelta, onDone, onError, signal }) {
    const auth = useAuthStore()

    return fetchEventSource(`${API_BASE}/api/psychological-chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({ sessionId, userMessage: message }),
        signal,
        // 非幂等接口：绝不自动重试
        retry: () => 'never',
        // 页面切到后台时不中断（长回复常被切换标签打断）
        openWhenHidden: true,

        onmessage(ev) {
            if (!ev.event || ev.event === 'message') {
                if (ev.data && ev.data !== '{}') {
                    try {
                        const payload = JSON.parse(ev.data)
                        if (payload.content) onDelta?.(payload.content)
                    } catch {
                        // 非 JSON 的片段按原文处理
                        if (ev.data) onDelta?.(ev.data)
                    }
                }
                return
            }
            if (ev.event === 'thinking') {
                onThinking?.()
                return
            }
            if (ev.event === 'done') {
                onDone?.()
                return
            }
            if (ev.event === 'error') {
                let payload = { code: 'UNKNOWN', msg: 'AI 服务异常' }
                try {
                    const parsed = JSON.parse(ev.data)
                    payload = { code: parsed.code || 'UNKNOWN', msg: parsed.msg || 'AI 服务异常' }
                } catch {
                    // 保持默认文案
                }
                onError?.(payload)
            }
        },

        onerror(err) {
            // 抛出以阻止库内重试逻辑；由调用方处理
            throw err
        },

        onclose() {
            // 正常关闭由 done 事件驱动，这里不重复触发
        }
    }).catch((err) => {
        if (err?.name === 'AbortError') {
            // 用户主动中断，不算错误
            return
        }
        onError?.({
            code: 'NETWORK_ERROR',
            msg: err?.message ? `连接中断：${err.message}` : '连接中断，请重试'
        })
    })
}
