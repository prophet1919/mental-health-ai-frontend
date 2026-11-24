import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 心理疏导回复以短段落为主，关闭 mangle 以避免邮箱自动化混淆带来的额外处理
marked.setOptions({
    breaks: true,   // 单个换行即换行，符合聊天语感
    gfm: true
})

// 白名单：只允许聊天场景需要的标签，杜绝 <img onerror>、<script> 一类注入
const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'del', 'code', 'pre',
    'ul', 'ol', 'li', 'blockquote', 'a', 'h1', 'h2', 'h3', 'h4', 'hr', 'table',
    'thead', 'tbody', 'tr', 'th', 'td'
]
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

/**
 * 把 AI 回复的 Markdown 转成安全的 HTML。
 * 注意：AI 输出是不可信内容（会复述用户输入），必须经过 DOMPurify。
 */
export function renderMarkdown(text) {
    if (!text) return ''
    const raw = marked.parse(text)
    return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        // 禁止 data: / javascript: 协议
        ALLOW_DATA_ATTR: false
    })
}

/** 为所有外链补 rel，防止 tabnabbing */
export function hardenLinks(html) {
    return html.replace(/<a\s+([^>]*href="[^"]*"[^>]*)>/gi, (match, attrs) => {
        if (/rel=/.test(attrs)) return match
        return `<a ${attrs} rel="noopener noreferrer" target="_blank">`
    })
}
