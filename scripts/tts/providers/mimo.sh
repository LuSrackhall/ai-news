#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# Mimo TTS provider — Xiaomi Mimo Token Plan
#
# Env:     MIMO_API_KEY            required
#          MIMO_BASE_URL           optional (default: https://token-plan-cn.xiaomimimo.com/v1)
#          MIMO_TTS_MODEL          optional (default: mimo-v2.5-tts)
#          MIMO_TTS_VOICE          optional (default: 苏打)
#          MIMO_TTS_MALE_VOICE     optional (default: Dean)
#          MIMO_TTS_FEMALE_VOICE   optional (default: 苏打)
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
  export MIMO_TTS_VOICE=苏打           # default voice
  export MIMO_TTS_MALE_VOICE=Dean      # male host voice (M)
  export MIMO_TTS_FEMALE_VOICE=苏打    # female host voice (F)

Available voices:
  苏打, 冰糖, 茉莉, 白桦, Mia, Chloe, Milo, Dean, mimo_default

Voice mapping for podcast:
  M (male host)   -> Dean
  F (female host) -> 苏打
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  local base="${MIMO_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}"
  local model="${MIMO_TTS_MODEL:-mimo-v2.5-tts}"

  # Use environment variable for default voice, fallback to 苏打
  local default_voice="${MIMO_TTS_VOICE:-苏打}"

  # Default voice from env
  if [[ -z "$voice" ]]; then
    voice="$default_voice"
  fi

  # Map M/F to voices (can be overridden by env vars)
  local male_voice="${MIMO_TTS_MALE_VOICE:-Dean}"
  local female_voice="${MIMO_TTS_FEMALE_VOICE:-苏打}"

  case "$voice" in
    M) voice="$male_voice" ;;
    F) voice="$female_voice" ;;
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
