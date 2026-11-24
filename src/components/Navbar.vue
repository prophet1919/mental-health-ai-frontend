<template>
    <div class="navbar">
        <div class="flex-box">
            <el-button @click="handleCollapse">
                <el-icon><Expand /></el-icon>
            </el-button>
            <p class="page-title">{{ currentTitle }}</p>
        </div>
        <div class="flex-box">
            <el-dropdown @command="handleCommand">
                <div class="flex-box">
                    <el-avatar :size="32">{{ (auth.displayName || 'A').slice(0, 1) }}</el-avatar>
                    <p class="user-name">{{ auth.displayName }}</p>
                    <el-icon><ArrowDown /></el-icon>
                </div>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item command="chat">返回对话</el-dropdown-item>
                        <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const currentTitle = computed(() => route.meta?.title || '管理后台')

const handleCommand = (command) => {
    if (command === 'logout') {
        auth.clear()
        router.replace('/login')
        return
    }
    if (command === 'chat') {
        router.push('/chat')
    }
}

const handleCollapse = () => {
    useAdminStore().toggleCollapse()
}
</script>

<style scoped lang="scss">
.navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    padding: 0 20px;
    background: #fff;
    border-bottom: 1px solid #eef1f5;

    .flex-box {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .page-title {
        font-size: 15px;
        font-weight: 500;
        color: #1f2937;
        margin: 0;
    }

    .user-name {
        font-size: 13px;
        color: #374151;
        margin: 0;
    }
}
</style>
