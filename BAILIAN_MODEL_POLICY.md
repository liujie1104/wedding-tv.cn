# 阿里云百炼免费模型使用政策

快照日期：2026-09-11
地域：华北 2（北京）
依据：账号所有者提供的百炼控制台“额度充沛模型”截图；额度单位同时按阿里云官方计费说明核对。

## 强制规则

1. 仅允许调用 `functions/config/bailian-free-models.json` 中记录的模型代码。
2. 模型必须同时满足：记录的剩余额度大于 0、用途匹配、控制台已开启“免费额度用完即停”。
3. 未在清单中、额度为 0、额度未知、名称被截图遮挡或用途不匹配的模型，一律拒绝调用。
4. `BAILIAN_MODEL`、`DASHSCOPE_MODEL`、`BAILIAN_IMAGE_MODEL` 只能从白名单选择，环境变量不能绕过校验。
5. 百炼请求只允许 `dashscope.aliyuncs.com` 或华北 2（北京）业务空间域名；其他地域、HTTP、非标准端口及 Token Plan 地址一律拒绝。
6. 免费额度是时间点快照，不是实时余额。每次更新截图后要同步更新 JSON；额度过期或耗尽时，即使代码仍在白名单中，百炼控制台的“用完即停”也必须保持开启。
7. 本清单只约束阿里云百炼模型，不影响 Google Gemini 或 Cloudflare Workers AI 等其他供应商。

## 当前站点默认模型

| 用途 | 模型 | 2026-09-11 剩余 / 总额度 |
|---|---|---:|
| 婚礼文案与策划 | `qwen3.8-flash` | 1,000,000 / 1,000,000 Token |
| 婚礼海报背景 | `qwen-image-3.0` | 10 / 10 张 |

## 完整额度记录

完整、可由程序读取的 80 个模型代码及额度位于 `functions/config/bailian-free-models.json`：

- 大语言模型：12 个可读代码，均为 1,000,000 / 1,000,000 Token。
- 视觉模型：10 个可读代码；图片 10 张或 100 张，视频 10 秒、30 秒或 50 秒。
- 向量模型：3 个可读代码，均为 1,000,000 / 1,000,000 Token。
- 语音模型：55 个可读代码；语音识别为 36,000 秒，Sambert 为 30,000 字符，Qwen TTS / CosyVoice 为 10,000 字符。

控制台分类总数为大语言 13、视觉 11、向量 3、语音 61。截图中分别有 1、1、0、6 个完整行被底部分页栏遮挡，无法可靠读取模型代码，因此这 8 个模型没有进入白名单。两个仅尾部被省略的语音代码已按阿里云官方文档核准为 `qwen-audio-3.0-asr-flash-streaming` 与 `qwen-audio-3.0-asr-flash-filetrans`。

## 运维核对

- 免费额度通常有有效期，而且不同模型额度互不通用；以百炼控制台实时余额和过期时间为准。
- 账号主账号与 RAM 子账号共享额度。
- 保持每个白名单模型的“免费额度用完即停”开关开启。
- 新增或切换模型前，先补充新的控制台额度证据，再修改白名单和测试；不能先调用后补记录。

官方参考：

- https://help.aliyun.com/zh/model-studio/new-free-quota
- https://help.aliyun.com/zh/model-studio/model-pricing
- https://help.aliyun.com/zh/model-studio/model-usage-statistics
