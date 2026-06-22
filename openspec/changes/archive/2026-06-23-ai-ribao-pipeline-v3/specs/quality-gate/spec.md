## ADDED Requirements

### Requirement: Schema Validation

validate-output.mjs SHALL 对 LLM 输出的 JSON 执行 Schema 校验。article.json 必须包含 hook（string）、summary_items（array, 1-8 items）、editorial（object，含 observation+evidence+judgment+prediction）。script.json 必须包含 hook、overview、closing（均为 object 含 text+duration_s）。optional 字段（deep_items、important_items、brief_items、quick_items）若存在则校验内部结构。

#### Scenario: article.json Schema 校验通过
- **WHEN** article.json 包含 hook（非空 string）、summary_items（3 条，每条含 title+one_liner）、editorial（含 4 个非空字段）
- **THEN** Schema 校验结果为 PASS

#### Scenario: article.json 缺少 required 字段
- **WHEN** article.json 中 editorial 字段缺失
- **THEN** Schema 校验结果为 FAIL，错误信息包含 "editorial: required field missing"

#### Scenario: editorial 缺少子字段
- **WHEN** article.json 的 editorial 只有 observation 和 evidence，缺少 judgment 和 prediction
- **THEN** Schema 校验结果为 FAIL，错误信息包含缺失的字段名

### Requirement: 内容质量校验

系统 SHALL 在 Schema 校验通过后执行内容质量校验，检查：URL 交叉比对（文章中 URL 必须存在于 curated.json）、空洞表述检测（"值得关注""意义深远""引发热议" 超过 3 处 → FAIL）、口播稿 duration_s 总和在 180-300s、editorial 四字段长度 > 30 字、deep_items details 含至少 1 个数字。

#### Scenario: 文章含编造 URL
- **WHEN** article.md 中出现 curated.json 中不存在的 URL "https://fake-news.com/ai"
- **THEN** 内容校验 FAIL，错误信息包含 "hallucinated_url: https://fake-news.com/ai"

#### Scenario: 空洞表述过多
- **WHEN** article.md 中 "值得关注" 出现 2 次，"意义深远" 出现 2 次（共 4 处 > 3 处阈值）
- **THEN** 内容校验 FAIL，错误信息包含 "empty_expressions: 4 occurrences"

#### Scenario: 口播稿时长超限
- **WHEN** script.json 各段 duration_s 总和为 350（超过 300s 上限）
- **THEN** 内容校验 FAIL，错误信息包含 "total_duration: 350s (expected 180-300)"

#### Scenario: editorial 过于简短
- **WHEN** editorial.observation 只有 15 个字（< 30 字阈值）
- **THEN** 内容校验 FAIL，错误信息包含 "editorial.observation: too short (15 chars, min 30)"

### Requirement: 校验失败处理策略

Schema 校验失败 SHALL 触发 LLM 重试一次。重试仍失败则 Fatal 终止。内容质量校验不通过 SHALL 继续写入文件，但 manifest 标记 validation_passed: false。

#### Scenario: Schema 失败后重试成功
- **WHEN** 第一次 article.json Schema 校验 FAIL（缺少 editorial），重试后通过
- **THEN** 流水线继续执行，manifest.pipeline.generate.retry_count = 1

#### Scenario: Schema 重试仍失败
- **WHEN** 两次 article.json Schema 校验均 FAIL
- **THEN** 系统 Fatal 终止，返回 `{ status: 'fatal', reason: 'schema_validation_failed', phase: 'validate' }`

#### Scenario: 内容校验不通过但继续写入
- **WHEN** Schema 校验 PASS，但内容校验 FAIL（空洞表述 4 处）
- **THEN** 文件正常写入，manifest.validate.validation_passed = false, manifest.validate.warnings 包含具体问题
