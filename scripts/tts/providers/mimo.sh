#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# Mimo TTS provider — Xiaomi Mimo Token Plan
#
# Env:     MIMO_API_KEY            required
#          MIMO_BASE_URL           optional (default: https://token-plan-cn.xiaomimimo.com/v1)
#          MIMO_TTS_MODEL          optional (default: mimo-v2.5-tts)
# Voices:  苏打 / 冰糖 / 茉莉 / 白桦 / Mia / Chloe / Milo / Dean / mimo_default
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if ! command -v curl >/dev/null; then
    echo "✗ curl not found." >&2
    return 1
  fi
  if [[ -z "${MIMO_API_KEY:-}" ]]; then
    echo "✗ MIMO_API_KEY is not set." >&2
    return 1
  fi
}

tts_install_help() {
  cat <<'EOF' >&2
To use Mimo TTS (Xiaomi Token Plan):

  export MIMO_API_KEY=your-mimo-api-key
  (get one at https://token-plan-cn.xiaomimimo.com)

Optional:
  export MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
  export MIMO_TTS_MODEL=mimo-v2.5-tts

Available voices:
  苏打, 冰糖, 茉莉, 白桦, Mia, Chloe, Milo, Dean, mimo_default
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  local base="${MIMO_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}"
  local model="${MIMO_TTS_MODEL:-mimo-v2.5-tts}"

  # Default voice
  if [[ -z "$voice" ]]; then
    voice="苏打"
  fi

  # Map M/F to voices
  case "$voice" in
    M) voice="Dean" ;;
    F) voice="苏打" ;;
  esac

  local escaped_text
  escaped_text=$(echo "$text" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

  local payload
  payload=$(cat <<EOF
{
  "model": "$model",
  "messages": [
    {"role": "user", "content": "请用语音说：$escaped_text"},
    {"role": "assistant", "content": ""}
  ],
  "modalities": ["text", "audio"],
  "audio": {
    "voice": "$voice",
    "format": "mp3"
  }
}
EOF
)

  curl -fsS -o "$out" -X POST "$base/chat/completions" \
    -H "Authorization: Bearer $MIMO_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null
}
