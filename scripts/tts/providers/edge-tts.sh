#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# edge-tts provider — Microsoft Edge TTS (免费，无需 API key)
#
# 安装: pip install edge-tts
# 音色: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
#       中文男声: zh-CN-YunxiNeural (默认), zh-CN-YunjianNeural
#       中文女声: zh-CN-XiaoxiaoNeural (默认), zh-CN-XiaoyiNeural
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if command -v edge-tts >/dev/null 2>&1; then
    return 0
  fi
  if python3 -c "import edge_tts" 2>/dev/null; then
    return 0
  fi
  echo "✗ edge-tts not found." >&2
  return 1
}

tts_install_help() {
  cat <<'EOF' >&2
To use edge-tts (free, no API key needed):

  pip install edge-tts

Voices:
  Male:   zh-CN-YunxiNeural (default), zh-CN-YunjianNeural
  Female: zh-CN-XiaoxiaoNeural (default), zh-CN-XiaoyiNeural

Set custom voices:
  export TTS_MALE_VOICE=zh-CN-YunjianNeural
  export TTS_FEMALE_VOICE=zh-CN-XiaoyiNeural
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"
  [[ -z "$voice" ]] && voice="zh-CN-YunxiNeural"

  local tmp="${out%.mp3}.tmp.mp3"

  # 优先用 CLI，不存在则用 python3 -m
  if command -v edge-tts >/dev/null 2>&1; then
    edge-tts --voice "$voice" --text "$text" --write-media "$tmp" 2>/dev/null
  else
    python3 -m edge_tts --voice "$voice" --text "$text" --write-media "$tmp" 2>/dev/null
  fi

  if [[ -f "$tmp" ]]; then
    mv "$tmp" "$out"
  else
    return 1
  fi
}
