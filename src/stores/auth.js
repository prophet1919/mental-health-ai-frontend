import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TOKEN_KEY = 'mha_token'
const USER_KEY = 'mha_user'

/**
 * 登录态。token 与用户信息持久化到 localStorage，
 * 刷新页面后仍保持登录；登出或 401 时清空。
 */
export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem(TOKEN_KEY) || '')
    const user = ref(readUser())

    const isLoggedIn = computed(() => !!token.value)
    const isAdmin = computed(() => Number(user.value?.userType) === 2)
    const displayName = computed(() => user.value?.displayName || user.value?.nickname || user.value?.username || '未登录')

    function readUser() {
        try {
            const raw = localStorage.getItem(USER_KEY)
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    }

    function setAuth(payload) {
        // payload 形如 { token, roleType, userInfo }
        token.value = payload.token || ''
        user.value = payload.userInfo || null
        localStorage.setItem(TOKEN_KEY, token.value)
        if (user.value) {
            localStorage.setItem(USER_KEY, JSON.stringify(user.value))
        } else {
            localStorage.removeItem(USER_KEY)
        }
    }

    function clear() {
        token.value = ''
        user.value = null
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
    }

    return { token, user, isLoggedIn, isAdmin, displayName, setAuth, clear }
})
