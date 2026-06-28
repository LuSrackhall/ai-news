## ADDED Requirements

### Requirement: 播客脚本转音频

将 script.json 中的双人对话数组合成为 MP3 音频文件。

#### Scenario: 正常合成
- **WHEN** 执行 `bash scripts/tts/synthesize.sh output/<date>/script.json`
- **THEN** 读取 script.json，遍历 hook/overview/deep_items/quick_items/closing 的对话数组
- **AND** 每段对话按 speaker 分配音色（M=男声，F=女声）
- **AND** 每段合成一个 MP3 到 `output/<date>/audio/segments/`
- **AND** 用 ffmpeg 合并所有分段为 `output/<date>/audio/podcast.mp3`

#### Scenario: ffmpeg 不可用
- **WHEN** 系统未安装 ffmpeg
- **THEN** 只保留分段文件，不报错，打印提示

### Requirement: Provider 切换

支持通过环境变量切换 TTS provider。

#### Scenario: 使用默认 provider
- **WHEN** 未设置 TTS_PROVIDER 环境变量
- **THEN** 使用 edge-tts 作为默认 provider

#### Scenario: 切换到 OpenAI
- **WHEN** 设置 `TTS_PROVIDER=openai` 且 `OPENAI_API_KEY` 已设置
- **THEN** 使用 OpenAI TTS API 合成

#### Scenario: provider 未安装
- **WHEN** 选择的 provider 的 `tts_check` 返回非零
- **THEN** 打印 `tts_install_help` 的内容并退出

### Requirement: 男女音色分配

双人对话中 M/F speaker 映射到不同音色。

#### Scenario: 默认音色映射
- **WHEN** 未设置 TTS_MALE_VOICE / TTS_FEMALE_VOICE 环境变量
- **THEN** edge-tts: M→YunxiNeural, F→XiaoxiaoNeural; OpenAI: M→onyx, F→nova; MiniMax: M→male-cn, F→female-cn

#### Scenario: 自定义音色
- **WHEN** 设置 `TTS_MALE_VOICE=zh-CN-YunjianNeural`
- **THEN** 所有 M speaker 的段使用 YunjianNeural 音色

### Requirement: 增量合成

已存在的分段文件不重复合成。

#### Scenario: 跳过已存在文件
- **WHEN** `output/<date>/audio/segments/001_M_hook_0.mp3` 已存在
- **THEN** 跳过该段，打印 "skip: 001_M_hook_0.mp3"

#### Scenario: 强制重合成
- **WHEN** 传入 `--force` 参数
- **THEN** 忽略已存在文件，全部重新合成

### Requirement: ai-daily 技能集成

在 ai-daily 技能流程中，渲染完成后 agent 询问用户是否合成音频。

#### Scenario: 用户选择合成
- **WHEN** agent 问"要不要合成音频？"且用户选择"合成"
- **THEN** agent 执行 `bash scripts/tts/synthesize.sh output/<date>/script.json`

#### Scenario: 用户选择跳过
- **WHEN** agent 问"要不要合成音频？"且用户选择"跳过"
- **THEN** 跳过音频合成，直接归档
