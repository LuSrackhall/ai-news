# TTS Providers

`synthesize.sh` 是 provider-agnostic 的 runner —— 它自己不知道怎么调任何 TTS，
只知道循环 segments、跳过已存在文件、打印进度。

**每个 provider 是这个目录下的一个 `.sh` 文件**，定义一个
`tts_synthesize` 函数（必需），以及可选的 `tts_check` 和
`tts_install_help`。runner 根据 `TTS_PROVIDER` 环境变量加载对应文件。

---

## 怎么用

```bash
# 默认（edge-tts）
bash scripts/tts/synthesize.sh output/2026-06-28/script.json

# 换 provider
TTS_PROVIDER=openai OPENAI_API_KEY=sk-... bash scripts/tts/synthesize.sh output/2026-06-28/script.json

# 指定音色
TTS_MALE_VOICE=zh-CN-YunxiNeural TTS_FEMALE_VOICE=zh-CN-XiaoxiaoNeural bash scripts/tts/synthesize.sh output/2026-06-28/script.json

# 强制全部重合成
bash scripts/tts/synthesize.sh --force output/2026-06-28/script.json
```

---

## 内置 provider

| 文件 | 后端 | 鉴权 | 备注 |
|---|---|---|---|
| `edge-tts.sh` | Microsoft Edge TTS | 无需（pip install edge-tts） | **默认**；免费，中文音色好 |
| `openai.sh` | OpenAI Audio Speech API | `OPENAI_API_KEY` env var | curl-based |
| `minimax.sh` | MiniMax TTS | `MINIMAX_API_KEY` env var | 中文口播质量稳 |

---

## 三函数契约

### `tts_synthesize <text> <out_path> [<voice>]` （required）

把一段文字合成音频写到 `<out_path>`（.mp3）。

| 参数 | 说明 |
|---|---|
| `$1` | 要合成的文本（UTF-8，可能中英混排） |
| `$2` | 目标文件绝对路径，扩展名 `.mp3` |
| `$3` | 音色 id（可能为空，provider 自行决定默认） |

成功 → exit 0。失败 → 非零退出（runner 标 FAILED 继续下一段）。

### `tts_check` （optional）

启动时被 runner 调一次。检查 CLI/API 是否就绪。未就绪 return 非零。

### `tts_install_help` （optional）

`tts_check` 失败时被 runner 调，往 stderr 打印安装指引。

---

## 怎么加你自己的 provider

1. 在这个目录建 `<name>.sh`（小写、kebab-case）
2. 实现 `tts_synthesize text out_path [voice]`（必需）
3. 可选实现 `tts_check` 和 `tts_install_help`
4. `TTS_PROVIDER=<name> bash scripts/tts/synthesize.sh ...`
