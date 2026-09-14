# wedding-tv.cn

面向新人与婚礼主持人的免费工具：扫码祝福大屏、婚礼流程 PNG 长图、电子请帖、AI 策划和备婚指南。

## 技术栈

- **前端**：纯静态 HTML/CSS/JS，无打包
- **运行时**：Cloudflare Workers（`src/worker.js` 入口） + Static Assets
- **数据**：Cloudflare KV（绑定名 `WEDDING`）+ SQLite-backed Durable Objects（绑定名 `WALL_DO`）
- **AI**：阿里云百炼 `qwen3.8-flash`（文本）+ `qwen-image-3.0`（海报图像）+ Google Gemini 2.5 Flash（文本兜底）+ Workers AI（头像）

## 目录

```
src/worker.js          Worker 入口，路由 /api/* 到 functions/api/*.js
functions/api/         后端处理函数（save/load/upload/img/story/avatar/ai/poster/poster-img）
functions/_lib.js      公共工具
functions/config/      百炼免费模型白名单与额度快照
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
| `WALL_DO` | SQLite-backed Durable Object | 新版房间有效期 7 天、每条祝福保留 24 小时；旧房间保持最后发送后 24 小时清空 |
| `AI` | Workers AI | 头像图像生成 |
| `ASSETS` | Static Assets | 静态资源 |
| `GEMINI_API_KEY` | Secret | Gemini API Key |
| `DASHSCOPE_API_KEY` | Secret | DashScope / 阿里云百炼 API Key（AI 文案、AI 策划、AI 海报） |
| `BAILIAN_BASE_URL` | Var | 可选，百炼 OpenAI 兼容模式 Base URL；不填则使用 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `BAILIAN_MODEL` | Var | AI 文案模型，只允许免费额度白名单；当前为 `qwen3.8-flash` |
| `BAILIAN_IMAGE_BASE_URL` | Var | 可选，百炼华北 2 业务空间域名，例如 `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com`；海报接口优先使用此值 |
| `BAILIAN_IMAGE_MODEL` | Var | AI 海报模型，只允许图片生成白名单；当前为 `qwen-image-3.0` |
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

## 扫码祝福大屏

- `/wedding-live-wall.html` 是公开、可索引的创建入口；`/live-wall.html?demo=1` 是不读写服务器的虚构演示。
- `/api/wall` 使用现有 `WallRoom` Durable Object，新房间 ID 以 `w_` 开头。旧 `save/load` 接口禁止访问此命名空间。
- 新房间默认先审后公开。管理密钥只通过创建响应返回，服务器存 SHA-256 摘要；分享时密钥放 URL fragment，后续操作走 Authorization 请求头。请勿把管理链接交给宾客或写进日志。
- 单条存储，事务内去重、计数和审核；累计上限 1000 条（含已删除及到期内容），达到上限返回错误，不覆盖旧记录。房间有效期 7 天，每条发送后 24 小时清除。
- PNG/CSV、二维码、背景及音乐在浏览器处理。抽奖只按昵称去重，不能当作真实身份认证。
- “正式活动”是创建者自报用途，不是核实的婚礼数；提交数也不是独立宾客数。本机汇总仅包含这台浏览器创建并同步过的房间，不是全站转化报表。
- 本次未新增 AI 调用或更改百炼模型。没有基于此功能做 AdSense 通过、增长或并发容量保证。

自动回归：`node --test scripts/test-api-regressions.mjs`，其中导入了管理房间的权限、幂等、并发、容量和到期测试。

浏览器联调需要可解析的 `playwright`、`sharp` 和已安装的浏览器：先运行本地 Wrangler，持久化目录放系统临时目录以避免资产监视器反复刷新，再运行 `node scripts/test-wall-browser.cjs`。默认地址为 `http://127.0.0.1:8789`，只允许 localhost；可用 `WALL_BROWSER_CHANNEL=msedge` 选择本机 Edge。测试只创建并删除本地试用房间，验证两个独立浏览器权限、CSV/PNG/JSON、320/390/1440 宽度和四种流程模板。

首批试用应找真实主持人或新人，先彩排，活动后收集设备与网络条件、审核是否及时、导出是否可用。不得把演示、开发测试或自报数据写成真实服务案例。

## AI 内容质量审查

发布新页面或自动化内容前，可以用百炼做一次 SEO / AdSense 风险审查：

```powershell
$env:DASHSCOPE_API_KEY="你的百炼或 DashScope Key"
python scripts/ai_content_quality.py index.html ai-planner.html guide.html
```

脚本会输出每个页面的 JSON 评分；`risk_level=high` 或 `score < 60` 时返回非 0 退出码，适合后续接入 GitHub Actions。

百炼模型必须遵守 [BAILIAN_MODEL_POLICY.md](BAILIAN_MODEL_POLICY.md)。未记录正数免费额度、未开启“免费额度用完即停”或用途不匹配的模型会在调用前被拒绝。
