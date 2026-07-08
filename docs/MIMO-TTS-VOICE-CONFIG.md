# MiMo TTS 音色配置说明

## 核心特性

### 1. API Key 池（防限流）
- 支持多个 API Key 自动轮换
- 遇到 429 限流时自动切换 Key
- 无缝重试，用户无感知

### 2. 两种音色模式

#### 模式1：预设音色（mimo-v2.5-tts）
使用 MiMo 提供的预设音色，简单快速。

**可用音色：**
- 女声：冰糖（温柔）/ 茉莉（清新）/ 苏打（沉稳）/ Mia（英文）/ Chloe（英文）
- 男声：白桦（稳重）/ Milo（英文）/ Dean（英文）

#### 模式2：自定义音色设计（mimo-v2.5-tts-voicedesign）⭐ 推荐
通过自然语言描述"创造"全新音色，打造独一无二的天籁之音。

**描述要素：**
- 年龄、性别
- 音色特点（温柔/磁性/甜美/沉稳等）
- 语速（较快/适中/较慢）
- 风格（专业/亲切/活泼等）
- 情感（热情/冷静/温暖等）

## 配置文件

### .env 配置

```bash
# ══════════════════════════════════════════════════════════════
# 共用配置
# ══════════════════════════════════════════════════════════════

# API Key 池（多个 Key 用逗号分隔）
MIMO_API_KEY_POOL=tp-key1,tp-key2,tp-key3

# API Endpoint
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1

# ══════════════════════════════════════════════════════════════
# 播客配置（PODCAST_ 前缀）
# ══════════════════════════════════════════════════════════════

# 模型选择
PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts-voicedesign

# 预设音色（MODEL=mimo-v2.5-tts 时使用）
PODCAST_MIMO_TTS_VOICE=冰糖
PODCAST_MIMO_TTS_MALE_VOICE=白桦
PODCAST_MIMO_TTS_FEMALE_VOICE=冰糖

# 自定义音色（MODEL=mimo-v2.5-tts-voicedesign 时使用）
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个28岁的知性女性，声音温柔清澈，语速较快
PODCAST_MIMO_TTS_MALE_VOICE_DESC=一个30岁的男性，声音温润磁性，语速较快

# 风格指令（可选）
# PODCAST_MIMO_TTS_STYLE=播客风格，语速适中，亲民

# ══════════════════════════════════════════════════════════════
# 视频配置（VIDEO_ 前缀）
# ══════════════════════════════════════════════════════════════

VIDEO_MIMO_TTS_MODEL=mimo-v2.5-tts
VIDEO_MIMO_TTS_VOICE=冰糖
```

## 使用方法

### 1. 配置 API Key 池

在 `.env` 中添加多个 Key：

```bash
MIMO_API_KEY_POOL=tp-key1,tp-key2,tp-key3,tp-key4
```

**获取 Key：**
- 访问 https://mimo.mi.com
- 进入 Token Plan → Console
- 创建多个 Key

### 2. 选择音色模式

#### 使用预设音色
```bash
PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts
PODCAST_MIMO_TTS_MALE_VOICE=白桦
PODCAST_MIMO_TTS_FEMALE_VOICE=冰糖
```

#### 使用自定义音色设计
```bash
PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts-voicedesign
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个28岁的知性女性，声音温柔如水
PODCAST_MIMO_TTS_MALE_VOICE_DESC=一个30岁的男性，声音温润磁性
```

### 3. 运行合成

```bash
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
TTS_PROVIDER=mimo bash scripts/tts/synthesize.sh --force output/production/ai/2026-06-29/script.json
```

## 音色设计示例

### 天籁之音系列

#### 温柔知性女声
```bash
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个28岁的知性女性，声音温柔如水，清澈悦耳，像春风拂面般舒适，温暖而有亲和力
```

#### 甜美活力女声
```bash
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个24岁的年轻女性，声音甜美清脆，充满活力，像银铃般悦耳动听
```

#### 优雅成熟女声
```bash
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个35岁的优雅女性，声音沉稳大气，温润如玉，像播音员般专业悦耳
```

### 磁性男声系列

#### 磁性暖男
```bash
PODCAST_MIMO_TTS_MALE_VOICE_DESC=一个30岁的男性，声音温润磁性，低沉有魅力，像大提琴般醇厚动听
```

#### 阳光少年
```bash
PODCAST_MIMO_TTS_MALE_VOICE_DESC=一个22岁的年轻男性，声音清朗阳光，充满朝气，像邻家男孩般亲切
```

#### 沉稳大叔
```bash
PODCAST_MIMO_TTS_MALE_VOICE_DESC=一个40岁的成熟男性，声音浑厚有力，沉稳大气，像新闻主播般专业
```

### 快节奏系列

#### 快节奏女声
```bash
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个28岁的知性女性，声音温柔清澈，语速较快，节奏紧凑，像专业播音员一样干脆利落
```

#### 快节奏男声
```bash
PODCAST_MIMO_TTS_MALE_VOICE_DESC=一个30岁的男性，声音温润磁性，语速较快，节奏明快，像新闻主播一样专业高效
```

## 语速控制技巧

在音色描述中加入语速相关词汇：

- **慢速**：语速较慢、节奏舒缓、娓娓道来
- **正常**：语速适中、节奏平稳
- **快速**：语速较快、节奏紧凑、干脆利落
- **超快**：语速很快、节奏明快、像机关枪一样快

示例：
```bash
# 慢速温柔
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个28岁的女性，声音温柔如水，语速较慢，娓娓道来

# 快速专业
PODCAST_MIMO_TTS_FEMALE_VOICE_DESC=一个28岁的女性，声音温柔清澈，语速较快，节奏紧凑，像专业播音员
```

## Key 池机制说明

### 工作原理
1. 初始化时加载所有 Key 到池中
2. 每次 API 调用使用下一个 Key（Round-Robin）
3. 遇到 429 限流时自动切换到下一个 Key
4. 所有 Key 都被限流后，等待 60 秒重试
5. 自动重置 Key 池，从第一个 Key 开始

### 优势
- ✅ **不会因单个 Key 限流而失败**
- ✅ **自动负载均衡**
- ✅ **无缝切换，用户无感知**
- ✅ **支持任意数量的 Key**

### 最佳实践
- 建议配置 3-5 个 Key
- 定期检查 Key 的使用情况
- 不同 Key 可以来自不同集群（中国/新加坡）

## 故障排除

### 问题：429 Too Many Requests
**原因**：API 限流
**解决**：
1. 配置多个 Key（推荐）
2. 等待 10-15 分钟后重试
3. 检查 Key 是否有效

### 问题：401 Invalid API Key
**原因**：Key 无效或过期
**解决**：
1. 检查 Key 是否正确
2. 确认 Key 所属集群（中国/新加坡）
3. 在 MiMo 控制台重新生成 Key

### 问题：音色不符合预期
**原因**：描述不够具体
**解决**：
1. 增加更多描述要素（年龄、语速、风格等）
2. 使用更生动的比喻（像春风、像大提琴等）
3. 尝试不同的描述组合

## 更新日志

- **2026-06-29**: 
  - 新增 API Key 池机制
  - 新增自定义音色设计（voicedesign）
  - 支持语速控制
  - 完善配置模板和文档
