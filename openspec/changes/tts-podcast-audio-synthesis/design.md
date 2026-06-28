## Context

AI 日报 editorial pipeline 产出 `script.json`（双人播客对话 JSON），需要 TTS 合成为 MP3。当前无 TTS 基础设施。

## Goals / Non-Goals

**Goals:**
- 将播客脚本 JSON 合成为完整 MP3
- 默认免费（edge-tts），可选 OpenAI/MiniMax
- 双人对话 M/F 分配不同音色
- 分段合成 + ffmpeg 合并

**Non-Goals:**
- 不进 pipeline（独立脚本）
- 不做音频后处理
- 不做自动发布

## Decisions

### D1: Shell 脚本 + 三函数契约
参考视频技能的 provider-agnostic 架构。每个 provider 一个 .sh 文件，实现 `tts_synthesize`/`tts_check`/`tts_install_help`。

### D2: 默认 edge-tts
免费，pip install。男声 `zh-CN-YunxiNeural`，女声 `zh-CN-XiaoxiaoNeural`。

### D3: 分段 + 合并
每段对话一个 MP3，ffmpeg 合并为 podcast.mp3。ffmpeg 不可用时只保留分段。

### D4: agent 询问触发
ai-daily 技能中，渲染后 agent 问"要不要合成音频？"。

## Risks / Trade-offs

- edge-tts 依赖 pip → tts_check 检查
- ffmpeg 依赖 → 不可用时降级
- TTS 质量 → 分段保留可单独重合成
