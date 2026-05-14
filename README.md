# wedding-tv.cn

稀缺婚礼行业品牌域名 + 一组面向新人的免费 AI 工具（电子请帖、誓词生成、筹备清单、倒计时海报、报价计算器…）。

## 技术栈

- **前端**：纯静态 HTML/CSS/JS，无打包
- **运行时**：Cloudflare Workers（`src/worker.js` 入口） + Static Assets
- **数据**：Cloudflare KV（绑定名 `WEDDING`）
- **AI**：Google Gemini 2.5 Flash（文本）+ Cloudflare Workers AI Flux.1 Schnell（图像）

## 目录

```
src/worker.js          Worker 入口，路由 /api/* 到 functions/api/*.js
functions/api/         所有后端处理函数（save / load / upload / img / story / avatar / ai / debug-env）
functions/_lib.js      公共工具
*.html                 首页 + 各工具/落地页（被 ASSETS 直接服务）
wrangler.jsonc         Cloudflare 配置（持久化 KV / AI / 环境变量）
.assetsignore          隔离不应公开的源码
```

## 本地开发

```powershell
npm install -g wrangler
wrangler dev
```

## 部署

主分支 push 到 GitHub → Cloudflare 自动构建并部署。

> ⚠️ 凡是希望持久存在的 KV/AI/vars 绑定，**必须**写入 `wrangler.jsonc`，否则每次推送会被覆盖。  
> 真正的 Secret（如 `GEMINI_API_KEY`）通过 Cloudflare Dashboard 的 Secrets 添加，不放仓库。

## 必需环境变量 / 绑定

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `WEDDING` | KV | 短链与请帖数据存储 |
| `AI` | Workers AI | 头像图像生成 |
| `ASSETS` | Static Assets | 静态资源 |
| `GEMINI_API_KEY` | Secret | Gemini API Key |
| `AVATAR_ENABLED` | Var | `true` / `false` 总开关 |
| `AVATAR_DAILY_LIMIT` | Var | 头像每日全站配额 |

## 自检

部署后访问 `/api/debug-env` 应返回所有项 ✅。
