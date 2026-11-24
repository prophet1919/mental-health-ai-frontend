<template>
    <div class="chat-page">
        <!-- 左侧会话列表 -->
        <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
            <div class="sidebar-head">
                <el-button type="primary" :icon="Plus" class="new-chat" @click="createSession">新的对话</el-button>
            </div>

            <el-scrollbar class="session-list">
                <div v-if="loadingSessions" class="list-loading">
                    <el-skeleton :rows="4" animated />
                </div>
                <el-empty v-else-if="!sessions.length" description="还没有对话，点上方开始吧" :image-size="70" />
                <div v-else>
                    <div v-for="item in sessions" :key="item.id" class="session-item"
                        :class="{ active: item.id === activeSessionId }" @click="openSession(item)">
                        <div class="item-title">{{ item.sessionTitle || '未命名会话' }}</div>
                        <div class="item-preview">{{ item.lastMessagePreview || '（暂无消息）' }}</div>
                        <div class="item-meta">
                            <span>{{ item.messageCount }} 条</span>
                            <span>{{ formatTime(item.lastActiveAt) }}</span>
                        </div>
                    </div>
                </div>
            </el-scrollbar>

            <div class="sidebar-foot">
                <el-dropdown @command="handleUserCommand">
                    <div class="user-chip">
                        <el-avatar :size="30">{{ (auth.displayName || 'U').slice(0, 1) }}</el-avatar>
                        <span class="user-name">{{ auth.displayName }}</span>
                        <el-icon><ArrowDown /></el-icon>
                    </div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item v-if="auth.isAdmin" command="admin">管理后台</el-dropdown-item>
                            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
        </aside>

        <!-- 右侧对话区 -->
        <main class="chat-main">
            <header class="chat-header">
                <div>
                    <h2>{{ activeSession?.sessionTitle || '新的对话' }}</h2>
                    <p class="subtitle">AI 只提供情绪陪伴，不替代专业诊断。如有紧急情况请拨打心理援助热线 12356。</p>
                </div>
            </header>

            <div ref="scrollRef" class="message-area">
                <div v-if="!messages.length && !streaming" class="empty-state">
                    <el-image :src="robotIcon" class="empty-icon" fit="contain" />
                    <h3>我在这里，想聊点什么？</h3>
                    <div class="quick-prompts">
                        <el-tag v-for="p in quickPrompts" :key="p" class="prompt-tag" @click="useQuickPrompt(p)">
                            {{ p }}
                        </el-tag>
                    </div>
                </div>

                <div v-for="msg in messages" :key="msg.key" class="message-row" :class="msg.role">
                    <el-avatar :size="34" class="avatar" :icon="msg.role === 'user' ? UserFilled : null"
                        :src="msg.role === 'assistant' ? robotIcon : undefined" />
                    <div class="bubble-wrap">
                        <!-- 用户消息按纯文本渲染，避免自身输入被解析 -->
                        <div v-if="msg.role === 'user'" class="bubble user-bubble">{{ msg.content }}</div>
                        <!-- AI 消息按 Markdown 渲染并消毒 -->
                        <div v-else class="bubble ai-bubble" v-html="renderSafe(msg.content)"></div>
                        <div v-if="msg.error" class="error-tip">
                            <el-alert :title="msg.content" type="warning" :closable="false" show-icon />
                            <el-button size="small" :icon="Refresh" @click="retry(msg)">重试</el-button>
                        </div>
                    </div>
                </div>

                <!-- 思考态：仅当已发送但首帧未到 -->
                <div v-if="thinking && !streamText" class="message-row assistant">
                    <el-avatar :size="34" class="avatar" :src="robotIcon" />
                    <div class="bubble ai-bubble thinking">
                        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                        <span class="thinking-text">小暖正在思考…</span>
                    </div>
                </div>

                <!-- 流式中的实时内容 -->
                <div v-if="streamText" class="message-row assistant">
                    <el-avatar :size="34" class="avatar" :src="robotIcon" />
                    <div class="bubble ai-bubble" v-html="renderSafe(streamText)"></div>
                </div>
            </div>

            <footer class="composer">
                <el-input v-model="draft" type="textarea" :rows="2" resize="none" maxlength="2000" show-word-limit
                    placeholder="说说你现在的感受…（Enter 发送，Shift+Enter 换行）" @keydown="onKeydown" />
                <div class="composer-actions">
                    <el-button v-if="streaming" :icon="VideoPause" @click="abortStream">停止</el-button>
                    <el-button type="primary" :icon="Promotion" :loading="sending" :disabled="!draft.trim() || streaming"
                        @click="send">
                        发送
                    </el-button>
                </div>
            </footer>
        </main>
    </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, ArrowDown, UserFilled, Promotion, VideoPause, Refresh } from '@element-plus/icons-vue'
import { listSessions, listMessages, startSession } from '@/api/chat'
import { streamChat } from '@/utils/sse'
import { renderMarkdown, hardenLinks } from '@/utils/markdown'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const robotIcon = new URL('@/assets/images/机器人.png', import.meta.url).href

const sidebarCollapsed = ref(false)
const loadingSessions = ref(false)
const sessions = ref([])
const activeSessionId = ref(null)
/** 已创建但尚无消息的会话，用于首轮对话前暂存 sessionId */
const pendingSessionId = ref(null)
const activeSession = computed(() => sessions.value.find((s) => s.id === activeSessionId.value) || null)

const messages = ref([])
const draft = ref('')
const sending = ref(false)
const streaming = ref(false)
const thinking = ref(false)
const streamText = ref('')
const scrollRef = ref(null)
let controller = null
let messageKeySeed = 0

const quickPrompts = [
    '最近总是睡不好，脑子里停不下来',
    '考试压力好大，一想到就心慌',
    '和室友闹矛盾了，不知道怎么办',
    '感觉自己很没用，什么都不想做'
]

onMounted(loadSessions)
onBeforeUnmount(() => abortStream())

function nextKey() {
    messageKeySeed += 1
    return `m${messageKeySeed}`
}

function renderSafe(text) {
    return hardenLinks(renderMarkdown(text))
}

function formatTime(value) {
    if (!value) return ''
    const d = new Date(String(value).replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const pad = (n) => String(n).padStart(2, '0')
    return sameDay
        ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
        : `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadSessions() {
    loadingSessions.value = true
    try {
        const data = await listSessions({ page: 1, size: 50 })
        sessions.value = data?.records || []
    } catch {
        sessions.value = []
    } finally {
        loadingSessions.value = false
    }
}

async function createSession() {
    if (streaming.value) {
        ElMessage.warning('请先等待当前回复结束或点击停止')
        return
    }
    try {
        const data = await startSession({})
        activeSessionId.value = null
        messages.value = []
        streamText.value = ''
        // 新会话尚未落消息，先记下 id，等首条消息发出后再刷新列表
        pendingSessionId.value = data.sessionId
        ElMessage.success('已新建对话，说点什么吧')
    } catch {
        // 拦截器已提示
    }
}

async function openSession(item) {
    if (streaming.value) {
        ElMessage.warning('请先等待当前回复结束或点击停止')
        return
    }
    activeSessionId.value = item.id
    pendingSessionId.value = null
    streamText.value = ''
    messages.value = []
    try {
        const list = await listMessages(item.sessionId, { size: 100 })
        messages.value = (list || []).map((m) => ({
            key: nextKey(),
            role: m.senderType === 1 ? 'user' : 'assistant',
            content: m.content || '',
            error: false,
            messageId: m.id
        }))
        scrollToBottom()
    } catch {
        // 拦截器已提示
    }
}

function useQuickPrompt(text) {
    draft.value = text
}

function onKeydown(e) {
    // Enter 发送，Shift+Enter 换行；输入法组合中不触发
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        send()
    }
}

async function send() {
    const text = draft.value.trim()
    if (!text || streaming.value) return

    // 若当前没有会话，先创建
    let sessionId = activeSession.value?.sessionId || pendingSessionId.value
    if (!sessionId) {
        try {
            const data = await startSession({})
            sessionId = data.sessionId
            pendingSessionId.value = sessionId
        } catch {
            return
        }
    }

    sending.value = true
    messages.value.push({ key: nextKey(), role: 'user', content: text, error: false })
    draft.value = ''
    streamText.value = ''
    thinking.value = true
    streaming.value = true
    controller = new AbortController()
    scrollToBottom()

    let received = ''

    streamChat({
        sessionId,
        message: text,
        signal: controller.signal,
        onThinking: () => {
            thinking.value = true
        },
        onDelta: (chunk) => {
            thinking.value = false
            received += chunk
            streamText.value = received
            scrollToBottom()
        },
        onDone: () => {
            thinking.value = false
            streaming.value = false
            sending.value = false
            if (received) {
                messages.value.push({ key: nextKey(), role: 'assistant', content: received, error: false })
            }
            streamText.value = ''
            // 首轮结束后会话才出现在列表里，刷新并选中
            refreshAfterFirstMessage(sessionId)
            scrollToBottom()
        },
        onError: (payload) => {
            thinking.value = false
            streaming.value = false
            sending.value = false
            if (received) {
                // 已收到部分内容：保留为正式消息，再附一条错误提示
                messages.value.push({ key: nextKey(), role: 'assistant', content: received, error: false })
            }
            streamText.value = ''
            messages.value.push({
                key: nextKey(),
                role: 'assistant',
                content: payload?.msg || 'AI 服务暂时不可用，请稍后重试',
                error: true,
                retryText: text
            })
            scrollToBottom()
        }
    }).finally(() => {
        sending.value = false
    })
}

async function refreshAfterFirstMessage(sessionId) {
    await loadSessions()
    const matched = sessions.value.find((s) => s.sessionId === sessionId)
    if (matched) {
        activeSessionId.value = matched.id
        pendingSessionId.value = null
    }
}

async function retry(msg) {
    if (streaming.value) return
    const text = msg.retryText
    if (!text) return
    // 移除错误提示，重新发送
    messages.value = messages.value.filter((m) => m.key !== msg.key)
    draft.value = text
    await send()
}

function abortStream() {
    if (controller) {
        controller.abort()
        controller = null
    }
    if (streaming.value) {
        streaming.value = false
        thinking.value = false
        sending.value = false
        if (streamText.value) {
            messages.value.push({ key: nextKey(), role: 'assistant', content: streamText.value, error: false })
        }
        streamText.value = ''
    }
}

function scrollToBottom() {
    nextTick(() => {
        const el = scrollRef.value
        if (el) el.scrollTop = el.scrollHeight
    })
}

function handleUserCommand(command) {
    if (command === 'logout') {
        auth.clear()
        router.replace('/login')
        return
    }
    if (command === 'admin') {
        router.push('/back/dashboard')
    }
}
</script>

<style scoped lang="scss">
.chat-page {
    display: flex;
    height: 100vh;
    background: #f7f9fc;
}

.sidebar {
    width: 280px;
    flex: none;
    background: #fff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;

    .sidebar-head {
        padding: 16px;

        .new-chat {
            width: 100%;
        }
    }

    .session-list {
        flex: 1;
        padding: 0 10px;
    }

    .list-loading {
        padding: 12px;
    }

    .session-item {
        padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
        margin-bottom: 6px;
        transition: background 0.15s;

        &:hover {
            background: #f3f6fb;
        }

        &.active {
            background: #e8f1ff;
            border-left: 3px solid #3b82f6;
        }

        .item-title {
            font-size: 14px;
            font-weight: 500;
            color: #1f2937;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .item-preview {
            font-size: 12px;
            color: #9ca3af;
            margin: 3px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .item-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #b0b7c3;
        }
    }

    .sidebar-foot {
        padding: 12px 16px;
        border-top: 1px solid #eef1f5;

        .user-chip {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;

            .user-name {
                font-size: 13px;
                color: #374151;
            }
        }
    }
}

.chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;

    .chat-header {
        padding: 18px 28px 14px;
        background: #fff;
        border-bottom: 1px solid #eef1f5;

        h2 {
            margin: 0 0 4px;
            font-size: 17px;
            color: #1f2937;
        }

        .subtitle {
            margin: 0;
            font-size: 12px;
            color: #9ca3af;
        }
    }

    .message-area {
        flex: 1;
        overflow-y: auto;
        padding: 24px 28px;
    }

    .empty-state {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;

        .empty-icon {
            width: 84px;
            height: 84px;
            opacity: 0.9;
        }

        h3 {
            margin: 0;
            font-size: 17px;
            color: #4b5563;
            font-weight: 500;
        }

        .quick-prompts {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            max-width: 520px;
            margin-top: 6px;
        }

        .prompt-tag {
            cursor: pointer;
        }
    }

    .message-row {
        display: flex;
        gap: 10px;
        margin-bottom: 18px;

        &.user {
            flex-direction: row-reverse;
        }

        .avatar {
            flex: none;
        }

        .bubble-wrap {
            max-width: 72%;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .bubble {
            padding: 11px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.65;
            word-break: break-word;
        }

        .user-bubble {
            background: #3b82f6;
            color: #fff;
            white-space: pre-wrap;
            border-top-right-radius: 4px;
        }

        .ai-bubble {
            background: #fff;
            color: #1f2937;
            border: 1px solid #eef1f5;
            border-top-left-radius: 4px;

            :deep(p) {
                margin: 0 0 8px;

                &:last-child {
                    margin-bottom: 0;
                }
            }

            :deep(ul),
            :deep(ol) {
                margin: 6px 0;
                padding-left: 20px;
            }

            :deep(code) {
                background: #f3f4f6;
                padding: 1px 5px;
                border-radius: 4px;
                font-size: 13px;
            }

            :deep(a) {
                color: #2563eb;
            }
        }

        .error-tip {
            display: flex;
            align-items: center;
            gap: 8px;
        }
    }

    .thinking {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #6b7280;

        .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #9ca3af;
            animation: blink 1.2s infinite;

            &:nth-child(2) {
                animation-delay: 0.2s;
            }

            &:nth-child(3) {
                animation-delay: 0.4s;
            }
        }

        .thinking-text {
            margin-left: 6px;
            font-size: 13px;
        }
    }

    .composer {
        padding: 14px 28px 18px;
        background: #fff;
        border-top: 1px solid #eef1f5;

        .composer-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 10px;
        }
    }
}

@keyframes blink {
    0%, 80%, 100% {
        opacity: 0.25;
    }
    40% {
        opacity: 1;
    }
}
</style>
