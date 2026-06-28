## Context

AI 日报项目已将口播稿改为双人播客对话格式（M/F speaker），但缺少 TTS 音频合成能力。需要将 `script.json`（对话数组 JSON）转为 MP3 音频文件。

当前 editorial pipeline 有 7 步（选题→文章→脚本→渲染→校验→归档），无音频合成步骤。脚本生成和音频合成均为可选步骤，通过 agent 交互询问用户控制。

参考 `web-video-presentation` 技能的 provider-agnostic TTS 架构（shell 脚本 + 三函数契约），适配到播客场景。

## Goals / Non-Goals

**Goals:**
- 将播客脚本 JSON 合成为完整 MP3 音频
- 默认使用免费 TTS（edge-tts），无需 API key
- 支持 OpenAI TTS、MiniMax 作为可选 provider
- 双人对话 M/F 分配不同音色
- 分段合成 + ffmpeg 合并为单个 podcast.mp3
- ai-daily 技能中 agent 询问用户是否合成

**Non-Goals:**
- 不进 editorial pipeline（独立脚本）
- 不做音频后处理（降噪、音量标准化）
- 不做自动发布到播客平台
- 不做实时流式合成

## Decisions

### D1: Shell 脚本架构（参考视频技能）

```
scripts/tts/
├── synthesize.sh              # runner：读 script.json → 分段 → 合成 → 合并
└── providers/
    ├── README.md              # 三函数契约说明
    ├── edge-tts.sh            # 默认，免费
    ├── openai.sh              # 需 OPENAI_API_KEY
    └── minimax.sh             # 需 MINIMAX_API_KEY
```

每个 provider 实现三函数契约：
- `tts_synthesize <text> <out_path> [<voice>]` — 必需
- `tts_check` — 可选，启动前校验
- `tts_install_help` — 可选，失败时提示安装

### D2: 默认 provider = edge-tts

- 免费，`pip install edge-tts` 即可
- 男声默认 `zh-CN-YunxiNeural`，女声默认 `zh-CN-XiaoxiaoNeural`
- 可通过环境变量覆盖：`TTS_PROVIDER`、`TTS_MALE_VOICE`、`TTS_FEMALE_VOICE`

### D3: 输出结构

```
output/<date>/audio/
├── segments/              # 分段音频
│   ├── 001_M_hook_0.mp3
│   ├── 002_F_hook_1.mp3
│   ├── 003_M_overview_0.mp3
│   └── ...
└── podcast.mp3            # ffmpeg 合并后的完整播客
```

- 分段文件保留，方便单独重合成某段
- ffmpeg 不可用时只保留分段文件，不报错

### D4: 触发方式（agent 交互）

ai-daily 技能流程中：
1. Step 4（脚本生成）前，agent 问"要不要生成播客脚本？"
2. Step 6（校验）后，agent 问"要不要合成音频？"

用户选"合成"→ agent 执行 `bash scripts/tts/synthesize.sh output/<date>/script.json`
用户选"跳过"→ 直接进下一步

非交互模式（如 cron）可通过环境变量 `GENERATE_SCRIPT=true` / `GENERATE_AUDIO=true` 后备控制。

### D5: script.json → segments 的转换逻辑

runner 读取 script.json，遍历每个 section（hook/overview/deep_items/quick_items/closing），展开对话数组为扁平 segment 列表：

```json
// script.json 输入
{ "hook": [{ "speaker": "M", "text": "...", "duration_s": 8 }, ...] }

// segments 输出
[
  { "index": 1, "speaker": "M", "text": "...", "section": "hook", "out": "segments/001_M_hook_0.mp3" },
  ...
]
```

## Risks / Trade-offs

- **edge-tts 依赖 pip** → `tts_check` 检查是否安装，`tts_install_help` 提示 `pip install edge-tts`
- **ffmpeg 依赖** → 合并步骤检查 ffmpeg，不可用则只保留分段文件
- **TTS 质量不稳定** → 分段文件保留，用户可单独重合成某段
- **edge-tts 是微软免费服务** → 可能有速率限制，runner 串行调用 + 段间延时
