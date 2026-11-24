<template>
    <div>
        <PageHead title="咨询记录">
            <template #buttons>
                <el-button :icon="Refresh" @click="load">刷新</el-button>
            </template>
        </PageHead>

        <TableSearch :formItem="formItem" @search="handleSearch" />

        <el-table v-loading="loading" :data="rows" border stripe class="session-table">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="sessionTitle" label="会话标题" min-width="200" show-overflow-tooltip />
            <el-table-column prop="userId" label="用户ID" width="90" />
            <el-table-column prop="messageCount" label="消息数" width="90" align="center" />
            <el-table-column prop="lastMessagePreview" label="最后消息" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                    <span class="preview">{{ row.lastMessagePreview || '—' }}</span>
                </template>
            </el-table-column>
            <el-table-column label="开始时间" width="170">
                <template #default="{ row }">{{ row.startedAt || '—' }}</template>
            </el-table-column>
            <el-table-column label="最后活跃" width="170">
                <template #default="{ row }">{{ row.lastActiveAt || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
                <template #default="{ row }">
                    <el-button link type="primary" @click="openDetail(row)">查看</el-button>
                </template>
            </el-table-column>
        </el-table>

        <div class="pager">
            <el-pagination background layout="total, prev, pager, next, sizes" :total="total"
                :current-page="page" :page-size="size" :page-sizes="[10, 20, 50]"
                @current-change="onPageChange" @size-change="onSizeChange" />
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import PageHead from '@/components/PageHead.vue'
import TableSearch from '@/components/TableSearch.vue'
import { listAllSessions } from '@/api/admin'

const router = useRouter()

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const keyword = ref('')

const formItem = [
    { comp: 'input', prop: 'keyword', label: '会话标题', placeholder: '输入关键词搜索' }
]

onMounted(load)

async function load() {
    loading.value = true
    try {
        const data = await listAllSessions({
            page: page.value,
            size: size.value,
            keyword: keyword.value || undefined
        })
        rows.value = data?.records || []
        total.value = data?.total || 0
    } catch {
        rows.value = []
        total.value = 0
    } finally {
        loading.value = false
    }
}

function handleSearch(formData) {
    keyword.value = formData?.keyword?.trim() || ''
    page.value = 1
    load()
}

function onPageChange(p) {
    page.value = p
    load()
}

function onSizeChange(s) {
    size.value = s
    page.value = 1
    load()
}

function openDetail(row) {
    router.push(`/back/consultation/${row.sessionId}`)
}
</script>

<style scoped lang="scss">
.session-table {
    margin-top: 14px;
}

.preview {
    color: #6b7280;
}

.pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}
</style>
