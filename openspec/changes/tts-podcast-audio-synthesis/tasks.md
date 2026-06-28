## 1. TTS 核心架构

- [x] 1.1 创建 `scripts/tts/providers/README.md`：三函数契约说明
- [x] 1.2 创建 `scripts/tts/providers/edge-tts.sh`：默认 provider（pip install edge-tts，男声 YunxiNeural / 女声 XiaoxiaoNeural）
- [x] 1.3 创建 `scripts/tts/providers/openai.sh`：OpenAI TTS provider（需 OPENAI_API_KEY）
- [x] 1.4 创建 `scripts/tts/providers/minimax.sh`：MiniMax TTS provider（需 MINIMAX_API_KEY）
- [x] 1.5 创建 `scripts/tts/synthesize.sh`：runner 脚本（读 script.json → 展开对话为 segments → 逐段合成 → ffmpeg 合并）

## 2. 技能集成

- [x] 2.1 更新 `.claude/skills/ai-daily/SKILL.md`：新增 Step 7 音频合成（agent 询问用户）
- [x] 2.2 更新 `docs/OPERATION.md`：新增 TTS 使用说明

## 3. 测试

- [ ] 3.1 用 6 月 28 日 script.json 测试 edge-tts 合成
- [ ] 3.2 验证分段文件和 podcast.mp3 生成正确
- [ ] 3.3 验证 --force 和增量合成逻辑
