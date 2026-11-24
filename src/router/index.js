import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// 布局与页面懒加载
const BackendLayout = () => import('@/components/BackendLayout.vue')

/** 用户端路由 */
const userRoutes = [
    {
        path: '/',
        redirect: '/chat'
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('@/views/Login.vue'),
        meta: { title: '登录', public: true }
    },
    {
        path: '/chat',
        name: 'chat',
        component: () => import('@/views/Chat.vue'),
        meta: { title: '对话', requiresAuth: true }
    }
]

/** 管理端路由 */
const backendRoutes = [
    {
        path: '/back',
        component: BackendLayout,
        redirect: '/back/dashboard',
        meta: { requiresAuth: true, requiresAdmin: true },
        children: [
            {
                path: 'dashboard',
                component: () => import('@/views/dashboard.vue'),
                meta: { title: '数据分析', icon: 'PieChart' }
            },
            {
                path: 'knowledge',
                component: () => import('@/views/knowledge.vue'),
                meta: { title: '知识文章', icon: 'ChatLineSquare' }
            },
            {
                path: 'consultation',
                component: () => import('@/views/consultation.vue'),
                meta: { title: '咨询记录', icon: 'Message' }
            },
            {
                path: 'consultation/:sessionId',
                component: () => import('@/views/consultation-detail.vue'),
                meta: { title: '会话详情', hidden: true }
            },
            {
                path: 'emotional',
                component: () => import('@/views/emotional.vue'),
                meta: { title: '情绪日志', icon: 'User' }
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes: [...userRoutes, ...backendRoutes]
})

router.beforeEach((to) => {
    const auth = useAuthStore()

    if (to.meta.public) {
        // 已登录访问登录页：按角色跳回各自首页
        if (auth.isLoggedIn) {
            return auth.isAdmin ? '/back/dashboard' : '/chat'
        }
        return true
    }

    if (to.meta.requiresAuth && !auth.isLoggedIn) {
        return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (to.meta.requiresAdmin && !auth.isAdmin) {
        // 普通用户访问后台：回到对话页，不暴露后台存在
        return '/chat'
    }

    return true
})

router.afterEach((to) => {
    const title = to.meta?.title
    document.title = title ? `${title} · 小暖助手` : '小暖助手'
})

export default router
