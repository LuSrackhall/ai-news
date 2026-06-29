# MiMo TTS 音色配置说明

## 共用 API Key

播客和视频生成技能**共用同一个 `MIMO_API_KEY`**，但音色配置完全独立。

## 配置方式

在根目录 `.env` 文件中配置：

```bash
# ══════════════════════════════════════════════
# 共用配置
# ══════════════════════════════════════════════
MIMO_API_KEY=tp-cny4x6jyde99h0gwtu61zmt2l60ixe7f9i0xrj5z4bgjsx55

# ══════════════════════════════════════════════
# 播客音频专用配置（PODCAST_ 前缀）
# ══════════════════════════════════════════════
PODCAST_MIMO_TTS_VOICE=苏打           # 默认音色
PODCAST_MIMO_TTS_MALE_VOICE=Dean      # 男主播音色
PODCAST_MIMO_TTS_FEMALE_VOICE=苏打    # 女主播音色
PODCAST_MIMO_TTS_STYLE=新闻播报风格，语速适中，沉稳大气

# ══════════════════════════════════════════════
# 视频生成专用配置（VIDEO_ 前缀）
# ══════════════════════════════════════════════
VIDEO_MIMO_TTS_VOICE=冰糖             # 视频默认音色
VIDEO_MIMO_TTS_STYLE=专业讲解风格，清晰流畅
```

## 可用音色

| 音色 | 性别 | 推荐场景 |
|------|------|----------|
| 冰糖 | 女 | 温柔亲切，适合视频讲解 |
| 茉莉 | 女 | 清新自然，适合轻松内容 |
| 苏打 | 女 | 沉稳大气，适合新闻播报 |
| 白桦 | 男 | 成熟稳重，适合深度分析 |
| Mia | 女 | 英文女声，适合双语内容 |
| Chloe | 女 | 英文女声，适合专业内容 |
| Milo | 男 | 英文男声，适合双语内容 |
| Dean | 男 | 英文男声，适合正式场合 |
| mimo_default | - | 系统默认 |

## 使用场景

### 播客音频
```bash
# 使用默认配置（PODCAST_ 前缀）
TTS_PROVIDER=mimo bash scripts/tts/synthesize.sh output/2026-06-29/script.json

# 临时覆盖音色
PODCAST_MIMO_TTS_MALE_VOICE=白桦 TTS_PROVIDER=mimo bash scripts/tts/synthesize.sh ...
```

### 视频生成
```bash
# 在 presentation 目录下
TTS_PROVIDER=mimo npm run synthesize-audio

# 临时覆盖音色
VIDEO_MIMO_TTS_VOICE=茉莉 TTS_PROVIDER=mimo npm run synthesize-audio
```

## 配置示例

### 方案1：标准播报（当前配置）
```bash
PODCAST_MIMO_TTS_MALE_VOICE=Dean
PODCAST_MIMO_TTS_FEMALE_VOICE=苏打
```
- 男主播：Dean（沉稳英文男声）
- 女主播：苏打（大气中文女声）

### 方案2：全中文播报
```bash
PODCAST_MIMO_TTS_MALE_VOICE=白桦
PODCAST_MIMO_TTS_FEMALE_VOICE=冰糖
```
- 男主播：白桦（稳重中文男声）
- 女主播：冰糖（温柔中文女声）

### 方案3：全女声播报
```bash
PODCAST_MIMO_TTS_MALE_VOICE=冰糖
PODCAST_MIMO_TTS_FEMALE_VOICE=茉莉
```
- 男主播：冰糖（用女声代替）
- 女主播：茉莉

### 方案4：视频专用（与播客不同）
```bash
# 播客用沉稳风格
PODCAST_MIMO_TTS_VOICE=苏打
PODCAST_MIMO_TTS_STYLE=新闻播报风格，语速适中，沉稳大气

# 视频用活泼风格
VIDEO_MIMO_TTS_VOICE=冰糖
VIDEO_MIMO_TTS_STYLE=生动讲解风格，富有感染力，节奏明快
```

## 优先级规则

1. **直接指定音色**（如 `voice="白桦"`）→ 直接使用
2. **指定 M/F** → 使用对应的 `*_MALE_VOICE` 或 `*_FEMALE_VOICE`
3. **未指定** → 使用 `*_VOICE` 默认值
4. **环境变量未设置** → 使用脚本内置默认值

## 验证配置

检查当前配置：
```bash
cat .env | grep -E "^(MIMO_API_KEY|PODCAST_|VIDEO_)"
```

测试音色（不实际合成）：
```bash
eval "$(cat .env | grep -v '^#' | sed 's/^/export /')"
echo "Podcast male: $PODCAST_MIMO_TTS_MALE_VOICE"
echo "Podcast female: $PODCAST_MIMO_TTS_FEMALE_VOICE"
echo "Video default: $VIDEO_MIMO_TTS_VOICE"
```

## 注意事项

1. **API Key 必填**：`MIMO_API_KEY` 是必须的，其他都是可选
2. **前缀隔离**：`PODCAST_` 和 `VIDEO_` 前缀避免配置冲突
3. **即时生效**：修改 `.env` 后重新运行合成即可
4. **大小写敏感**：音色名称必须完全匹配（如"苏打"不是"苏达"）
5. **中英文混排**：文本中的英文会自动处理，无需特殊配置
