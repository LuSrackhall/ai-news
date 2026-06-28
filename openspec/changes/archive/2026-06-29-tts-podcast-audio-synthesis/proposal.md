## Why

AI 日报项目已将口播稿改为双人播客对话格式（M/F），但缺少 TTS 音频合成能力。播客脚本生成了 `script.json`（对话数组），但无法转为可发布的 MP3 音频。需要集成 TTS 能力，让 `/daily` 流程可以一站式产出日报文章 + 播客音频。

## What Changes

- 新增 `scripts/tts/` 目录：provider-agnostic TTS 架构（参考 web-video-presentation 技能）
- 新增 `scripts/tts/synthesize.sh`：runner 脚本，读取 script.json → 分段合成 → ffmpeg 合并
- 新增 `scripts/tts/providers/edge-tts.sh`：默认免费 provider
- 新增 `scripts/tts/providers/openai.sh`：可选 provider（需 OPENAI_API_KEY）
- 新增 `scripts/tts/providers/minimax.sh`：可选 provider（需 MINIMAX_API_KEY）
- 更新 `ai-daily` 技能文档：新增音频合成步骤，agent 询问用户是否合成

## Capabilities

### New Capabilities
- `tts-synthesis`: 将播客脚本 JSON 合成为 MP3 音频（provider-agnostic，双人对话音色分配）

### Modified Capabilities

## Impact

- `scripts/tts/synthesize.sh` — 新增 runner 脚本
- `scripts/tts/providers/` — 新增 3 个 provider
- `.claude/skills/ai-daily/SKILL.md` — 新增音频合成步骤
- `docs/OPERATION.md` — 新增 TTS 使用说明
