# wedding-tv.cn

稀缺婚礼行业品牌域名 + 一组面向新人的免费 AI 工具（AI 婚礼策划助手、电子请帖、誓词生成、筹备清单、倒计时海报、报价计算器…）。

## 技术栈

- **前端**：纯静态 HTML/CSS/JS，无打包
- **运行时**：Cloudflare Workers（`src/worker.js` 入口） + Static Assets
- **数据**：Cloudflare KV（绑定名 `WEDDING`）+ SQLite-backed Durable Objects（绑定名 `WALL_DO`）
- **AI**：Google Gemini 2.5 Flash（文本）+ DashScope wanx2.1-t2i-turbo（海报图像）+ Workers AI（头像）

## 目录

```
src/worker.js          Worker 入口，路由 /api/* 到 functions/api/*.js
functions/api/         后端处理函数（save/load/upload/img/story/avatar/ai/poster/poster-img）
functions/_lib.js      公共工具
*.html                 首页 + 各工具/落地页（被 ASSETS 直接服务）
wrangler.jsonc         Cloudflare 配置（KV/Durable Objects/AI/vars）
.assetsignore          隔离不应公开的源码
```

## 路由策略

- 首页以 `/` 为 canonical，其余公开静态文档以 `.html` URL 为 canonical；sitemap、RSS 与站内链接保持一致。
- Cloudflare Static Assets 使用 `html_handling: "none"`，确保 `.html` canonical 直接返回 `200`，不被平台自动改写。
- 无扩展名和尾斜杠旧地址由 Worker 以 `301` 永久重定向到对应 `.html`；`index.html` 重定向到首页，`live.html` 重定向到 `live-wall.html`。
- `404.html` 只作为真实 `404` 响应返回，不能作为可索引的 `200` 页面。

## 本地开发

需要 Node.js 22 或更高版本。

```powershell
npm install -g wrangler
wrangler dev
```

## 部署

主分支 push 到 GitHub → Cloudflare 自动构建并部署。GitHub Actions 先完成 Wrangler dry-run 和内容审计，再等待 Cloudflare 的提交检查成功并确认线上 sitemap 与当前提交一致，最后才提交 IndexNow 和百度链接推送。

> 凡是希望持久存在的 KV、Durable Objects、AI 或 vars 绑定，**必须**写入 `wrangler.jsonc`，否则每次推送会被覆盖。
> 真正的 Secret（如 `GEMINI_API_KEY`、`DASHSCOPE_API_KEY`）通过 Cloudflare Dashboard 的 Secrets 添加，不放仓库。

## 必需环境变量 / 绑定

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `WEDDING` | KV | 短链与请帖数据存储 |
| `WALL_DO` | SQLite-backed Durable Object | 按房间串行保存现场祝福，最后一条留言后 24 小时自动清空 |
| `AI` | Workers AI | 头像图像生成 |
| `ASSETS` | Static Assets | 静态资源 |
| `GEMINI_API_KEY` | Secret | Gemini API Key |
| `DASHSCOPE_API_KEY` | Secret | DashScope / 阿里云百炼 API Key（AI 文案、AI 策划、AI 海报） |
| `BAILIAN_BASE_URL` | Var | 可选，百炼 OpenAI 兼容模式 Base URL；不填则使用 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `BAILIAN_MODEL` | Var | 可选，AI 文案模型；不填则使用 `qwen-plus` |
| `AVATAR_ENABLED` | Var | `true` / `false` 总开关 |
| `AVATAR_DAILY_LIMIT` | Var | 头像每日全站配额 |

## 自检

不要通过公开接口输出 Secret 的内容、长度或片段。部署前运行静态审计，部署后只检查公开页面、响应头和不包含配置详情的正常错误响应：

```powershell
node scripts/audit-static-content.cjs
npx --yes wrangler@4.128.0 deploy --dry-run --outdir .wrangler/dry-run
curl.exe -I https://wedding-tv.cn/
curl.exe "https://wedding-tv.cn/api/load?id=missing"
```

首页应返回 `200`，无效请帖应返回通用的 `404` JSON，任何响应都不应泄露环境变量或密钥信息。

## AI 内容质量审查

发布新页面或自动化内容前，可以用百炼做一次 SEO / AdSense 风险审查：

```powershell
$env:DASHSCOPE_API_KEY="你的百炼或 DashScope Key"
python scripts/ai_content_quality.py index.html ai-planner.html guide.html
```

脚本会输出每个页面的 JSON 评分；`risk_level=high` 或 `score < 60` 时返回非 0 退出码，适合后续接入 GitHub Actions。
