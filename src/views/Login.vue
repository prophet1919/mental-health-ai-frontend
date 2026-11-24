<template>
    <div class="login-page">
        <div class="login-card">
            <div class="brand">
                <el-image :src="robotIcon" class="brand-icon" fit="contain" />
                <div>
                    <h1>小暖助手</h1>
                    <p>心理健康 AI 陪伴 · 随时说说心里话</p>
                </div>
            </div>

            <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleSubmit">
                <el-form-item prop="username">
                    <el-input v-model="form.username" placeholder="用户名或邮箱" :prefix-icon="User" clearable />
                </el-form-item>
                <el-form-item prop="password">
                    <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock"
                        show-password @keyup.enter="handleSubmit" />
                </el-form-item>

                <el-button type="primary" class="submit-btn" :loading="loading" @click="handleSubmit">
                    {{ loading ? '登录中…' : '登 录' }}
                </el-button>
            </el-form>

            <div class="footer-links">
                <el-link type="primary" :underline="false" @click="showRegister = true">还没有账号？注册</el-link>
                <el-link :underline="false" @click="goAdmin">进入管理后台</el-link>
            </div>

            <el-alert v-if="backendHint" :title="backendHint" type="warning" :closable="false" show-icon class="hint" />
        </div>

        <el-dialog v-model="showRegister" title="注册新账号" width="440px">
            <el-form ref="registerRef" :model="registerForm" :rules="registerRules" label-width="80px">
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="registerForm.username" placeholder="3-50 位字母、数字或下划线" />
                </el-form-item>
                <el-form-item label="邮箱" prop="email">
                    <el-input v-model="registerForm.email" placeholder="用于登录与找回" />
                </el-form-item>
                <el-form-item label="昵称" prop="nickname">
                    <el-input v-model="registerForm.nickname" placeholder="选填" />
                </el-form-item>
                <el-form-item label="密码" prop="password">
                    <el-input v-model="registerForm.password" type="password" show-password placeholder="至少 6 位" />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                    <el-input v-model="registerForm.confirmPassword" type="password" show-password />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showRegister = false">取消</el-button>
                <el-button type="primary" :loading="registering" @click="handleRegister">注册</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { login, register, health } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const robotIcon = new URL('@/assets/images/机器人.png', import.meta.url).href

const formRef = ref()
const loading = ref(false)
const backendHint = ref('')

const form = reactive({ username: '', password: '' })

const rules = {
    username: [{ required: true, message: '请输入用户名或邮箱', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const showRegister = ref(false)
const registering = ref(false)
const registerRef = ref()
const registerForm = reactive({
    username: '', email: '', nickname: '', password: '', confirmPassword: ''
})

const registerRules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 50, message: '长度 3-50 位', trigger: 'blur' },
        { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线', trigger: 'blur' }
    ],
    email: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, max: 50, message: '密码 6-50 位', trigger: 'blur' }
    ],
    confirmPassword: [
        { required: true, message: '请再次输入密码', trigger: 'blur' },
        {
            validator: (_r, value, cb) =>
                value === registerForm.password ? cb() : cb(new Error('两次输入密码不一致')),
            trigger: 'blur'
        }
    ]
}

onMounted(checkBackend)

async function checkBackend() {
    try {
        await health()
        backendHint.value = ''
    } catch {
        backendHint.value = '无法连接后端服务，请确认已启动 ai-springboot（端口 1236）'
    }
}

async function handleSubmit() {
    if (!formRef.value) return
    try {
        await formRef.value.validate()
    } catch {
        return
    }
    loading.value = true
    try {
        const data = await login({ username: form.username.trim(), password: form.password })
        auth.setAuth(data)
        ElMessage.success(`欢迎回来，${data.userInfo?.displayName || data.userInfo?.username || ''}`)
        const redirect = route.query.redirect
        if (redirect) {
            router.replace(String(redirect))
        } else if (Number(data.userInfo?.userType) === 2) {
            router.replace('/back/dashboard')
        } else {
            router.replace('/chat')
        }
    } catch {
        // 错误提示已由请求拦截器统一处理
    } finally {
        loading.value = false
    }
}

async function handleRegister() {
    if (!registerRef.value) return
    try {
        await registerRef.value.validate()
    } catch {
        return
    }
    registering.value = true
    try {
        await register({
            username: registerForm.username.trim(),
            email: registerForm.email.trim(),
            nickname: registerForm.nickname?.trim() || undefined,
            password: registerForm.password,
            confirmPassword: registerForm.confirmPassword
        })
        ElMessage.success('注册成功，请登录')
        showRegister.value = false
        form.username = registerForm.username
        form.password = ''
    } catch {
        // 拦截器已提示
    } finally {
        registering.value = false
    }
}

function goAdmin() {
    router.push('/back/dashboard')
}
</script>

<style scoped lang="scss">
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e8f3ff 0%, #f5f0ff 50%, #eefaf5 100%);
    padding: 24px;
}

.login-card {
    width: 100%;
    max-width: 420px;
    background: #fff;
    border-radius: 18px;
    padding: 36px 32px 28px;
    box-shadow: 0 18px 50px rgba(31, 58, 95, 0.12);

    .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 28px;

        .brand-icon {
            width: 56px;
            height: 56px;
            flex: none;
        }

        h1 {
            font-size: 22px;
            margin: 0 0 4px;
            color: #1f2937;
        }

        p {
            margin: 0;
            font-size: 13px;
            color: #6b7280;
        }
    }

    .submit-btn {
        width: 100%;
        height: 44px;
        font-size: 16px;
        letter-spacing: 2px;
        margin-top: 4px;
    }

    .footer-links {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
        font-size: 13px;
    }

    .hint {
        margin-top: 16px;
    }
}
</style>
