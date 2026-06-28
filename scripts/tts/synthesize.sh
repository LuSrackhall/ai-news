#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# synthesize.sh — 播客脚本 TTS 合成 runner
#
# 读取 script.json（双人对话格式），展开为 segments，逐段调用
# TTS provider 合成，最后用 ffmpeg 合并为 podcast.mp3。
#
# 用法:
#   bash scripts/tts/synthesize.sh output/2026-06-28/script.json
#   TTS_PROVIDER=openai OPENAI_API_KEY=sk-... bash scripts/tts/synthesize.sh ...
#   bash scripts/tts/synthesize.sh --force output/2026-06-28/script.json
#
# 环境变量:
#   TTS_PROVIDER       provider 名称 (默认: edge-tts)
#   TTS_MALE_VOICE     男声音色 (默认: 由 provider 决定)
#   TTS_FEMALE_VOICE   女声音色 (默认: 由 provider 决定)
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDERS_DIR="$SCRIPT_DIR/providers"

PROVIDER="${TTS_PROVIDER:-edge-tts}"
MALE_VOICE="${TTS_MALE_VOICE:-}"
FEMALE_VOICE="${TTS_FEMALE_VOICE:-}"
FORCE=false

# 解析参数
SCRIPT_JSON=""
for arg in "$@"; do
  case "$arg" in
    --force)    FORCE=true ;;
    -*)         echo "✗ unknown flag: $arg" >&2; exit 1 ;;
    *)          SCRIPT_JSON="$arg" ;;
  esac
done

if [[ -z "$SCRIPT_JSON" ]]; then
  echo "用法: bash scripts/tts/synthesize.sh [--force] <script.json>" >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_JSON" ]]; then
  echo "✗ 文件不存在: $SCRIPT_JSON" >&2
  exit 1
fi

# 加载 provider
PROVIDER_FILE="$PROVIDERS_DIR/${PROVIDER}.sh"
if [[ ! -f "$PROVIDER_FILE" ]]; then
  echo "✗ 未知 provider: $PROVIDER" >&2
  echo "可用: $(ls "$PROVIDERS_DIR"/*.sh 2>/dev/null | xargs -I{} basename {} .sh | tr '\n' ' ')" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$PROVIDER_FILE"

# 检查 provider 就绪
if type tts_check >/dev/null 2>&1; then
  if ! tts_check; then
    type tts_install_help >/dev/null 2>&1 && tts_install_help
    exit 1
  fi
fi

# 确定音色（无自定义时传 speaker 标识，由 provider 决定默认音色）
get_voice() {
  local speaker="$1"
  if [[ "$speaker" == "M" ]]; then
    echo "${MALE_VOICE:-M}"
  else
    echo "${FEMALE_VOICE:-F}"
  fi
}

# 输出目录
SCRIPT_DIR_OUT="$(dirname "$SCRIPT_JSON")"
AUDIO_DIR="$SCRIPT_DIR_OUT/audio"
SEGMENTS_DIR="$AUDIO_DIR/segments"
mkdir -p "$SEGMENTS_DIR"

# 用 node 解析 script.json 为 segments
SEGMENTS_JSON=$(node -e "
const fs = require('fs')
const data = JSON.parse(fs.readFileSync('$SCRIPT_JSON', 'utf-8'))
const segments = []
let idx = 0

const getDur = (s) => s?.durationS || s?.duration_s || 0
const isDialogue = (item) => Array.isArray(item)

const flattenSection = (section, sectionName) => {
  if (!section) return
  if (isDialogue(section)) {
    section.forEach((line, i) => {
      idx++
      segments.push({ index: idx, speaker: line.speaker || 'M', text: line.text, section: sectionName, subIndex: i })
    })
  } else if (section.text) {
    idx++
    segments.push({ index: idx, speaker: 'M', text: section.text, section: sectionName, subIndex: 0 })
  }
}

flattenSection(data.hook, 'hook')
flattenSection(data.overview, 'overview')
for (const item of (data.deepItems || data.deep_items || [])) {
  if (item.dialogue) {
    item.dialogue.forEach((line, i) => {
      idx++
      segments.push({ index: idx, speaker: line.speaker || 'M', text: line.text, section: 'deep', subIndex: i })
    })
  } else if (item.text) {
    idx++
    segments.push({ index: idx, speaker: 'M', text: item.text, section: 'deep', subIndex: 0 })
  }
}
for (const item of (data.quickItems || data.quick_items || [])) {
  if (item.dialogue) {
    item.dialogue.forEach((line, i) => {
      idx++
      segments.push({ index: idx, speaker: line.speaker || 'M', text: line.text, section: 'quick', subIndex: i })
    })
  } else if (item.text) {
    idx++
    segments.push({ index: idx, speaker: 'M', text: item.text, section: 'quick', subIndex: 0 })
  }
}
flattenSection(data.closing, 'closing')

console.log(JSON.stringify(segments))
")

TOTAL=$(echo "$SEGMENTS_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.length)")
echo "共 $TOTAL 个 segments，provider: $PROVIDER"

# 逐段合成
SYNTHESIZED=0
SKIPPED=0
FAILED=0
MERGE_LIST="$AUDIO_DIR/merge_list.txt"
> "$MERGE_LIST"

for i in $(seq 0 $((TOTAL - 1))); do
  SEG=$(echo "$SEGMENTS_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); const s=d[$i]; const pad=String(s.index).padStart(3,'0'); console.log(JSON.stringify({...s, filename: pad+'_'+s.speaker+'_'+s.section+'_'+s.subIndex+'.mp3'}))")

  FILENAME=$(echo "$SEG" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).filename)")
  TEXT=$(echo "$SEG" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).text)")
  SPEAKER=$(echo "$SEG" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).speaker)")

  OUT_PATH="$SEGMENTS_DIR/$FILENAME"
  echo "file '$OUT_PATH'" >> "$MERGE_LIST"

  if [[ -f "$OUT_PATH" ]] && [[ "$FORCE" != "true" ]]; then
    echo "  [$((i+1))/$TOTAL] skip: $FILENAME"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  VOICE="$(get_voice "$SPEAKER")"
  echo -n "  [$((i+1))/$TOTAL] $FILENAME ... "

  if tts_synthesize "$TEXT" "$OUT_PATH" "$VOICE"; then
    echo "ok"
    SYNTHESIZED=$((SYNTHESIZED + 1))
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
  fi

  # 段间延时，避免速率限制
  sleep 0.3
done

echo ""
echo "合成完成: $SYNTHESIZED 新增, $SKIPPED 跳过, $FAILED 失败"

# ffmpeg 合并
PODCAST="$AUDIO_DIR/podcast.mp3"
if command -v ffmpeg >/dev/null 2>&1; then
  if [[ -f "$PODCAST" ]] && [[ "$FORCE" != "true" ]]; then
    echo "podcast.mp3 已存在（用 --force 重新合并）"
  else
    echo -n "合并为 podcast.mp3 ... "
    ffmpeg -y -f concat -safe 0 -i "$MERGE_LIST" -c copy "$PODCAST" >/dev/null 2>&1
    if [[ -f "$PODCAST" ]]; then
      DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$PODCAST" 2>/dev/null | cut -d. -f1)
      echo "ok (${DURATION}s)"
    else
      echo "FAILED"
    fi
  fi
else
  echo "⚠ ffmpeg 未安装，跳过合并。分段文件在: $SEGMENTS_DIR"
fi

echo ""
echo "输出目录: $AUDIO_DIR"
