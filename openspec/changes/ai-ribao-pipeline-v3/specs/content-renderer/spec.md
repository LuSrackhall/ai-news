## ADDED Requirements

### Requirement: 文章 JSON 渲染为 Markdown

render-article.mjs SHALL 接收 article.json（LLM 输出的结构化数据）并渲染为符合模板规范的 Markdown 文章。渲染器同时承担格式化职责（Formatter + Template）。

#### Scenario: 正常渲染完整文章
- **WHEN** 输入 article.json 包含 hook、summary_items（5条）、deep_items（2条）、important_items（4条）、brief_items（3条）、editorial
- **THEN** 输出 Markdown 包含：标题（# AI 日报 | {date}）、钩子引用块、今日速览、重磅深度（四段结构）、重要动态、快讯、编辑观点，总字数 2000-6000

#### Scenario: 缺少 optional 字段时降级渲染
- **WHEN** article.json 中 deep_items 为空数组（0 条）
- **THEN** 跳过"重磅深度"板块，其余板块正常渲染

#### Scenario: 格式化处理
- **WHEN** article.json 中 hook 字段包含英文引号 "AI" 和半角逗号
- **THEN** Renderer 自动将英文引号转为中文引号「AI」，半角逗号转为全角逗号

### Requirement: 口播稿 JSON 渲染为 Markdown

render-script.mjs SHALL 接收 script.json 并渲染为带时间标注的口播稿 Markdown。

#### Scenario: 正常渲染口播稿
- **WHEN** 输入 script.json 包含 hook（18s）、overview（16s）、deep_items（2条，共90s）、quick_items（4条，共72s）、closing（17s）
- **THEN** 输出 Markdown 每段前标注 **[{秒数}s]**，总时长 213s（在 180-300s 范围内）

#### Scenario: 从文章生成脚本的一致性
- **WHEN** article.json 的 deep_items 包含 "DeepSeek-V4" 和 "John Jumper"
- **THEN** script.json 的 deep_items 必须覆盖相同的条目（串行生成保证）

### Requirement: 多平台扩展支持

Renderer 的设计 SHALL 支持未来新增渲染目标（微信公众号 HTML、RSS、邮件等），只需新增 Renderer 文件，不修改 LLM prompt 或 pipeline 逻辑。

#### Scenario: 新增微信公众号 Renderer
- **WHEN** 需要支持微信公众号发布
- **THEN** 只需新增 render-wechat.mjs，读取同一份 article.json，输出 HTML 格式；article.json 和 LLM prompt 无需任何修改

### Requirement: Renderer 版本管理

Renderer SHALL 包含独立的 renderer_version 常量，记录在 manifest.json 中。Renderer 变更时递增版本号。

#### Scenario: Renderer 变更追踪
- **WHEN** render-article.mjs 的模板结构调整（如新增"关键数据"板块）
- **THEN** renderer_version 递增，manifest.json 中记录新版本号
