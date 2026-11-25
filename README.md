# 心理健康 AI 助手 · 前端

基于 Vue 3 + Element Plus 的心理健康陪伴系统前端，包含**用户端对话界面**与**管理后台**两套入口。

> 后端仓库：[mental-health-ai-backend](https://github.com/prophet1919/mental-health-ai-backend)

---

## 项目简介

面向在校学生的心理健康 AI 陪伴系统。学生可在对话页与 AI 倾诉并获得共情回应，历史对话可随时回溯；心理中心管理员可在后台查看全部咨询记录。

**用户端**：登录注册、AI 流式对话、会话历史
**管理端**：会话审阅列表、会话详情

---

## 技术栈

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | Vue | 3.5 |
| 构建 | Vite | 8.x |
| UI | Element Plus | 2.14 |
| 路由 | Vue Router | 4.6 |
| 状态 | Pinia | 4.1 |
| 请求 | Axios | 1.21 |
| 流式 | @microsoft/fetch-event-source | 2.0 |
| Markdown | marked + DOMPurify | 18.x / 3.5 |
| 样式 | SCSS | — |

---

## 快速开始

### 1. 环境要求

- Node.js 18+
- pnpm（推荐）或 npm
- **后端服务已在 `1236` 端口运行**

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

```bash
pnpm dev
```

浏览器打开 http://localhost:5173

### 4. 构建生产版本

```bash
pnpm build
pnpm preview
```

---

## 后端连接说明

开发环境通过 **Vite 代理**转发，浏览器侧始终是同源请求，不产生跨域预检：

```js
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:1236',
      changeOrigin: true
    }
  }
}
```

因此 `request.js` 的 `baseURL` 使用**相对路径**（空字符串）。部署到生产环境时，由 Nginx 做同样的 `/api` 转发即可，无需改代码。

> 若后端不在 `1236` 端口，修改 `vite.config.js` 的 `proxy.target`。
> 修改 `vite.config.js` 后**必须重启 dev server** 才生效。

---

## 页面路由

| 路径 | 页面 | 说明 | 权限 |
| --- | --- | --- | --- |
| `/login` | 登录页 | 用户名/邮箱登录，含注册弹窗 | 公开 |
| `/chat` | 对话页 | 用户端主界面 | 登录用户 |
| `/back/dashboard` | 数据分析 | 占位，待接入 | 管理员 |
| `/back/consultation` | 咨询记录 | 全部会话列表 | 管理员 |
| `/back/consultation/:sessionId` | 会话详情 | 完整对话回溯 | 管理员 |
| `/back/knowledge` | 知识文章 | 占位，待接入 | 管理员 |
| `/back/emotional` | 情绪日志 | 占位，待接入 | 管理员 |

**路由守卫规则**：

- 未登录访问受保护页面 → 跳 `/login?redirect=原路径`
- 已登录访问 `/login` → 按角色跳转（管理员进后台，普通用户进对话）
- 普通用户访问 `/back/**` → 静默退回 `/chat`（不暴露后台存在）

---

## 项目结构

```
src/
├── api/                    接口定义
│   ├── user.js             登录、注册、当前用户
│   ├── chat.js             会话与消息
│   └── admin.js            后台审阅
├── components/             通用组件
│   ├── BackendLayout.vue   后台布局
│   ├── Sidebar.vue         侧边菜单
│   ├── Navbar.vue          顶部栏
│   ├── PageHead.vue        页头
│   └── TableSearch.vue     通用搜索表单
├── router/index.js         路由与守卫
├── stores/
│   ├── auth.js             登录态（持久化到 localStorage）
│   └── admin.js            后台 UI 状态
├── utils/
│   ├── request.js          Axios 封装（统一鉴权与错误处理）
│   ├── sse.js              SSE 客户端
│   └── markdown.js         Markdown 渲染 + XSS 消毒
├── views/
│   ├── Login.vue           登录页
│   ├── Chat.vue            对话页
│   ├── dashboard.vue       数据分析（占位）
│   ├── consultation.vue    咨询记录列表
│   ├── consultation-detail.vue  会话详情
│   ├── knowledge.vue       知识文章（占位）
│   └── emotional.vue       情绪日志（占位）
├── assets/                 图片资源
├── App.vue
└── main.js
```

---

## 核心实现说明

### SSE 为什么禁用自动重试

`@microsoft/fetch-event-source` 默认会在连接失败时自动重连。但对话接口**非幂等**——每次调用都会写入用户消息并消耗模型额度。若启用重连，一次网络抖动就会导致消息重复落库、费用重复扣除。

因此显式设置：

```js
retry: () => 'never',   // 绝不自动重试
openWhenHidden: true    // 切到后台不中断长回复
```

失败由前端渲染「可重试气泡」，何时重试交给用户决定。

### 为什么不用原生 EventSource

原生 `EventSource` **不支持自定义请求头**，而本项目鉴权使用 `Authorization: Bearer <token>`。除非把 token 塞进 URL query（会泄露到日志），否则无法使用。

`fetch-event-source` 基于 `fetch`，可携带任意头，并支持 `AbortController` 中断。

### AI 回复为什么要消毒

AI 输出会**复述用户输入**。若直接 `v-html` 渲染，用户在输入框里写 `<img src=x onerror=alert(1)>` 就能触发 XSS。

因此所有 AI 消息走：

```js
marked.parse(text) → DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
```

用户自己发的消息则按**纯文本**渲染（`white-space: pre-wrap`），双重保险。

### 「正在思考」状态

`deepseek-flash` 是推理模型，流式响应前几帧的 `content` 为空。后端会在正文前发一个 `thinking` 事件，前端据此显示三点跳动动画：

```
发送 → [thinking 事件] → 显示"小暖正在思考…" → [message 事件] → 逐字渲染
```

没有这个状态，用户点发送后会看到数秒空白，体验上等同于卡死。

---

## 与后端的接口约定

统一响应格式：

```json
{ "code": "200", "msg": "操作成功", "data": { } }
```

- `code === "200"` 视为成功，`request.js` 直接返回 `data`
- 其他 code 统一弹 `ElMessage.error(msg)` 并 reject
- HTTP 401 自动清除登录态并跳转登录页

SSE 事件类型：`thinking` / `message` / `done` / `error`

---

## 已知限制

1. **后台三个页面仍为占位**（数据分析、知识文章、情绪日志）
2. **无自动化测试**，验证方式为手工走查
3. **图片资源含中文文件名**（`机器人.png` 等），Windows/macOS 下正常，个别 Linux 环境需注意编码
4. **无国际化**，仅支持简体中文

---

## 开发约定

- 分支：`main` 为稳定分支，功能在 `vibecoding` 分支开发
- 提交信息：`feat:` / `fix:` / `chore:` 前缀
- 新接口统一放在 `src/api/` 下，按业务拆分文件
- 新增页面记得在 `router/index.js` 注册并配置 `meta.title`

---

## 许可证

本项目为课程设计作品，仅供学习交流。
