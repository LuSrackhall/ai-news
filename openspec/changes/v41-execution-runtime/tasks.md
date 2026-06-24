## 1. Runtime 框架层

- [x] 1.1 创建 `scripts/runtime/host.mjs`：Host 接口定义（log/invoke/metric/now/elapsed）
- [x] 1.2 创建 `scripts/runtime/result.mjs`：ExecutionResult 结构（stepName/status/outputs/metrics/errors/duration）
- [x] 1.3 创建 `scripts/runtime/graph.mjs`：ExecutionGraph + ExecutionNode 定义（taskId/condition/retry/timeout/depends）
- [x] 1.4 创建 `scripts/runtime/session.mjs`：ExecutionSession（runId/status/stepResults/toResult()）
- [x] 1.5 创建 `scripts/runtime/registry.mjs`：TaskRegistry（register/resolve，resolve 每次返回全新实例）
- [x] 1.6 创建 `scripts/runtime/context.mjs`：ExecutionContext（host + resources + scope）
- [x] 1.7 创建 `scripts/runtime/compiler.mjs`：GraphCompiler（compile(pipeline) → ExecutionGraph，只做静态展开和校验）
- [x] 1.8 创建 `scripts/runtime/runtime.mjs`：Runtime 执行引擎（execute(graph, ctx) → Session，驱动 Task 生命周期，统一补 duration，捕获异常）

## 2. Host 实现

- [x] 2.1 创建 `scripts/hosts/claude-host.mjs`：ClaudeHost 实现（封装 phase/agent/log 原语）

## 3. Policy Engine

- [x] 3.1 创建 `scripts/policies/ranking-policy.mjs`：RankingPolicy（组合 AuthorityRule/TimelinessRule/EntityWeightRule/EventTypeRule/QuantitativeRule/AcademicRule，返回 ranked assets）
- [x] 3.2 创建 `scripts/rules/authority-rule.mjs`：AuthorityRule（tier → score，纯函数）
- [x] 3.3 创建 `scripts/rules/timeliness-rule.mjs`：TimelinessRule（age → score）
- [x] 3.4 创建 `scripts/rules/entity-weight-rule.mjs`：EntityWeightRule（实体匹配 → bonus score）
- [x] 3.5 创建 `scripts/rules/event-type-rule.mjs`：EventTypeRule（关键词/regex → bonus score）
- [x] 3.6 创建 `scripts/rules/quantitative-rule.mjs`：QuantitativeRule（数字信号 → bonus score）
- [x] 3.7 创建 `scripts/rules/academic-rule.mjs`：AcademicRule（学术信号 → bonus score）
- [x] 3.8 创建 `scripts/policies/dedup-policy.mjs`：DedupPolicy（组合 title-similarity-rule + event-fingerprint-rule，返回 { kept, removed }）
- [x] 3.9 创建 `scripts/rules/title-similarity-rule.mjs`：TitleSimilarityRule（bigram 相似度 ≥ 0.5 判定重复）
- [x] 3.10 创建 `scripts/rules/event-fingerprint-rule.mjs`：EventFingerprintRule（Entity|EventType|Keywords|Week 指纹匹配）
- [x] 3.11 创建 `scripts/policies/validation-policy.mjs`：ValidationPolicy（schema 校验 + 8 项内容质量检查）
- [x] 3.12 创建 `scripts/policies/render-policy.mjs`：RenderPolicy（article/script 模板渲染）
- [x] 3.13 创建 `scripts/infrastructure/policies.mjs`：buildPolicyEngine()（注册所有 Policy）

## 4. Data Access

- [x] 4.1 创建 `scripts/storage/json-file-storage.mjs`：JsonFileStorage（read/write，output/<date>/ 目录）
- [x] 4.2 创建 `scripts/repositories/event-repository.mjs`：EventRepository（store/remove）
- [x] 4.3 创建 `scripts/repositories/asset-repository.mjs`：AssetRepository（store/remove）
- [x] 4.4 创建 `scripts/repositories/artifact-repository.mjs`：ArtifactRepository（store/remove）
- [x] 4.5 创建 `scripts/read-models/event-read-model.mjs`：EventReadModel（load/history）
- [x] 4.6 创建 `scripts/read-models/asset-read-model.mjs`：AssetReadModel（load）
- [x] 4.7 创建 `scripts/read-models/artifact-read-model.mjs`：ArtifactReadModel（load/loadMarkdown）
- [x] 4.8 创建 `scripts/infrastructure/scope.mjs`：buildScope(host, date)（组装 events/assets/artifacts 的 repository + readModel，以及 inferenceService/policyEngine/unitOfWork）

## 5. Inference Service

- [x] 5.1 创建 `scripts/services/inference-profiles/article-profile.mjs`：ArticleProfile（prompt/schema/retry/validator）
- [x] 5.2 创建 `scripts/services/inference-profiles/script-profile.mjs`：ScriptProfile
- [x] 5.3 创建 `scripts/services/inference-profiles/curation-profile.mjs`：CurationProfile
- [x] 5.4 创建 `scripts/services/inference-service.mjs`：InferenceService（run(name, vars) → 渲染 Profile → host.invoke → JSON 解析兜底 → 重试 → 校验）

## 6. Task 实现

- [x] 6.1 创建 `scripts/tasks/collect-assets.mjs`：CollectAssets Task（调 host.invoke 执行 collect-rss.mjs，写入 assets repository）
- [x] 6.2 创建 `scripts/tasks/verify-assets.mjs`：VerifyAssets Task（调 host.invoke 执行 verify-urls.mjs，写回 assets repository）
- [x] 6.3 创建 `scripts/tasks/score-events.mjs`：ScoreEvents Task（readModel.load → policyEngine.execute('ranking') → buildEvents → repository.store）
- [x] 6.4 创建 `scripts/tasks/dedup-events.mjs`：DedupEvents Task（readModel.load + history(14) → policyEngine.execute('dedup') → repository.store）
- [x] 6.5 创建 `scripts/tasks/curate-events.mjs`：CurateEvents Task（readModel.load → inferenceService.run('curation') → repository.store）
- [x] 6.6 创建 `scripts/tasks/generate-article.mjs`：GenerateArticle Task（readModel.load → inferenceService.run('article') → artifactRepository.store）
- [x] 6.7 创建 `scripts/tasks/generate-script.mjs`：GenerateScript Task（readModel.load + article → inferenceService.run('script') → artifactRepository.store）
- [x] 6.8 创建 `scripts/tasks/render-artifacts.mjs`：RenderArtifacts Task（readModel.load article + script → policyEngine.execute('render') → artifactRepository.store rendered）
- [x] 6.9 创建 `scripts/tasks/validate-output.mjs`：ValidateOutput Task（readModel.load artifacts + events → policyEngine.execute('validate') → 返回 PhaseResult）
- [x] 6.10 创建 `scripts/tasks/archive-output.mjs`：ArchiveOutput Task（readModel.load → 写磁盘文件 article.md/script.md/article.json/script.json → 更新 index.json）

## 7. Pipeline + Workflow

- [ ] 7.1 创建 `scripts/pipelines/daily.mjs`：DailyPipeline 声明（10 个 steps）
- [ ] 7.2 创建 `scripts/pipelines/index.mjs`：PipelineSet（{ daily: dailyPipeline }）
- [ ] 7.3 创建 `ai-ribao-daily.js`（~30 行）：Host → Scope → ExecutionContext → TaskRegistry → Runtime → execute(dailyPipeline)

## 8. 测试

- [ ] 8.1 创建 `scripts/test-runtime.mjs`：Runtime 框架测试（TaskRegistry resolve 全新实例、ExecutionGraph 序列化、ExecutionSession 记录、PolicyEngine 注册表、Repository store/load、ReadModel history）
- [ ] 8.2 运行 v3 测试确认不受影响（scripts/test-modules.mjs）
- [ ] 8.3 端到端运行 v4.1 workflow 对比产出

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/v4.1-execution-runtime`
