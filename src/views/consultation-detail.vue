<template>
    <div>
        <PageHead :title="`会话详情 · ${session?.sessionTitle || ''}`">
            <template #buttons>
                <el-button :icon="Back" @click="goBack">返回列表</el-button>
            </template>
        </PageHead>

        <el-descriptions v-if="session" :column="4" border class="info">
            <el-descriptions-item label="会话ID">{{ session.sessionId }}</el-descriptions-item>
            <el-descriptions-item label="用户ID">{{ session.userId }}</el-descriptions-item>
            <el-descriptions-item label="消息数">{{ session.messageCount }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ session.startedAt }}</el-descriptions-item>
        </el-descriptions>

        <div v-loading="loading" class="message-list">
            <el-empty v-if="!loading && !messages.length" description="该会话暂无消息" />
            <div v-for="msg in messages" :key="msg.id" class="message-row" :class="msg.role">
                <div class="meta">
                    <span class="sender">{{ msg.senderTypeDesc }}</span>
                    <span class="time">{{ msg.createdAt }}</span>
                </div>
                <div class="bubble" :class="msg.role">
                    <template v-if="msg.role === 'assistant'">
                        <div v-html="renderSafe(msg.content)"></div>
                    </template>
                    <template v-else>{{ msg.content }}</template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Back } from '@element-plus/icons-vue'
import PageHead from '@/components/PageHead.vue'
import { getSessionDetail, getSessionMessages } from '@/api/admin'
import { renderMarkdown, hardenLinks } from '@/utils/markdown'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const session = ref(null)
const messages = ref([])

onMounted(load)

function renderSafe(text) {
    return hardenLinks(renderMarkdown(text))
}

async function load() {
    const sessionId = String(route.params.sessionId || '')
    if (!sessionId) return
    loading.value = true
    try {
        const detail = await getSessionDetail(sessionId)
        session.value = detail?.records?.[0] || null

        const list = await getSessionMessages(sessionId, { size: 200 })
        messages.value = (list || []).map((m) => ({
            ...m,
            role: m.senderType === 1 ? 'user' : 'assistant'
        }))
    } catch {
        session.value = null
        messages.value = []
    } finally {
        loading.value = false
    }
}

function goBack() {
    router.push('/back/consultation')
}
</script>

<style scoped lang="scss">
.info {
    margin: 14px 0 18px;
}

.message-list {
    min-height: 200px;
}

.message-row {
    margin-bottom: 16px;

    .meta {
        display: flex;
        gap: 10px;
        font-size: 12px;
        color: #9ca3af;
        margin-bottom: 4px;
    }

    .bubble {
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
        line-height: 1.7;
        max-width: 78%;
        word-break: break-word;
        white-space: pre-wrap;

        &.assistant {
            background: #f6f8fb;
            border: 1px solid #eef1f5;
            color: #1f2937;
        }

        &.user {
            background: #e8f1ff;
            color: #1e3a5f;
            margin-left: auto;
        }

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
            background: #eef1f5;
            padding: 1px 5px;
            border-radius: 4px;
        }
    }

    &.user {
        .meta {
            justify-content: flex-end;
        }
    }
}
</style>
