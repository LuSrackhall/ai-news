## 1. Editorial Pipeline 路径修复

- [ ] 1.1 修改 `scripts/tasks-editorial/archive-output.mjs`：`join('.', 'output', date)` → `join('.', 'output/production/ai', date)`
- [ ] 1.2 修改 `scripts/tasks-editorial/archive-output.mjs` 中其余路径引用（L31 等）

## 2. 旧版/周报/Ingestion 路径修复

- [ ] 2.1 修改 `scripts/tasks/archive-output.mjs`（旧版）路径
- [ ] 2.2 修改 `scripts/tasks-weekly/archive-weekly.mjs` 路径
- [ ] 2.3 修改 `scripts/tasks/score-events.mjs` 中 `join('.', 'output', ...)` 路径

## 3. 验收与渲染脚本确认

- [ ] 3.1 修复 `scripts/validate-output.mjs` 中 3 处 article.md 路径硬编码（L55/L61/L73）：`output/${date}/article.md` → `${OUTPUT_DIR}/${date}/article.md`
- [ ] 3.2 修复 `scripts/validate-output.mjs` 中 baseline 路径（L151）为 `join(OUTPUT_DIR, '..', 'baseline', 'ai', 'baseline.json')` 或使用绝对路径
- [ ] 3.3 确认 `scripts/render-article.mjs` 路径已正确（默认 `output/production/ai`）
- [ ] 3.4 确认 `scripts/output-acceptance.mjs` 路径已正确

## 4. SKILL.md 与基础设施

- [ ] 4.1 修改 `.claude/skills/ai-daily/skill.md` Step 5（渲染）内联代码路径
- [ ] 4.2 修改 Step 6（校验）内联代码路径
- [ ] 4.3 修改 Step 8（归档）内联代码路径和 index.json 路径
- [ ] 4.4 修改 `scripts/storage/json-file-storage.mjs` 的默认 outputDir（L9）
- [ ] 4.5 修改 `scripts/domain/editorial/test-replay.mjs` 的候选路径（添加 `output/production/ai`）

## 5. 验证

- [ ] 5.1 确认所有 `join('.', 'output',` 模式已替换或指向新路径
- [ ] 5.2 使用 `OUTPUT_DIR=output/production/ai` 跑一次验收：`node scripts/output-acceptance.mjs all`
- [ ] 5.3 回归确认：用旧路径跑验收依然可用：`OUTPUT_DIR=output node scripts/output-acceptance.mjs all`
