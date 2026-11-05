# Wedding News Drafts

周刊不是固定周更任务。没有可核验、与备婚直接相关的新热点，就不出刊。
既有实务指南属于归档，不能改标题或日期当作新新闻。

## 发布流程

1. 主编选择过去 7 个自然日内的一手新信息，实际打开来源核对机构、日期、原文和适用范围。
2. 先检索站内往期及指南。已经报道的事件在原文更新，不另起一期；背景旧政策不能充当新事件。
3. 审阅完成后添加 `issue-N.json`，写出真实审阅者与核验日期。未批准稿、空稿、过期新闻正常跳过。
4. 运行 `python scripts/generate_weekly_digest.py --issue N --dry-run`。来源门槛、事件与正文去重检查通过后，才手动运行发布工作流。
5. 不创建占位页面，不在跳过时更新博客、RSS、sitemap、社交文案或提交。

必要字段结构如下；下面是格式说明，不是真实新闻，不可直接发布：

```json
{
  "title": "备婚周刊第N期：真实事件的具体标题",
  "short_title": "对应本期内容的简短标题",
  "description": "独立、准确的本期摘要，不堆砌关键词或承诺效果。",
  "review": {
    "status": "draft",
    "reviewer": "实际完成核验的成员",
    "reviewed_at": "YYYY-MM-DD"
  },
  "news": [{
    "event_id": "stable-event-id-not-a-week-number",
    "title": "来源所支持的具体事件",
    "url": "https://official-source.example/event",
    "published_at": "YYYY-MM-DD",
    "verified_at": "YYYY-MM-DD",
    "primary_source": true,
    "summary": "至少30字，说明新发生了什么、涉及哪些地区或人群、读者应如何理解；不把旧指南包装成新热点。"
  }],
  "highlights": [{
    "section": "影响解读",
    "title": "本期独有的解读",
    "content": "<p>对已核验事件的独立解读，说明适用范围与未知信息，不复制往期正文。</p>"
  }]
}
```

日期按北京时间，来源发布日期须距发布当天不足 7 天；`verified_at` 应介于来源发布日期和审阅日期之间。新刊不得回填旧日期伪装时效。`event_id` 应标识真实事件，不能用每周期号规避去重。

自动检查会将候选稿与往期周刊、站内 Article / BlogPosting 指南正文比对，拦截缺字段、旧日期、重复事件、整篇近似和重复长段落，但不能证明来源内容真实、审核确由本人完成或改写后语义绝无重复；这些仍需主编核验，不能让 AI 自行填 `approved`。

## 旧稿修订

`python scripts/generate_weekly_digest.py --issue 2 --revise` 仅修订原有归档 URL，保留原发布日期、更新修订日期，不生成社交推广文案。新刊不能使用历史稿库兜底，也不能覆盖已发布期号。
