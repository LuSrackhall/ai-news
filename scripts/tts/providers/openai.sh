#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# OpenAI TTS provider — Audio Speech REST API via curl
#
# Env:     OPENAI_API_KEY=sk-...     required
#          OPENAI_BASE_URL           optional (for proxies / Azure)
#          OPENAI_TTS_MODEL          optional (tts-1 / tts-1-hd)
# Voices:  alloy / echo / fable / onyx / nova / shimmer
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if ! command -v curl >/dev/null; then
    echo "✗ curl not found." >&2
    return 1
  fi
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "✗ OPENAI_API_KEY is not set." >&2
    return 1
  fi
}

tts_install_help() {
  cat <<'EOF' >&2
To use OpenAI TTS:

  export OPENAI_API_KEY=sk-...
  (get one at https://platform.openai.com/api-keys)

Optional:
  export OPENAI_BASE_URL=https://your-proxy/v1
  export OPENAI_TTS_MODEL=tts-1-hd   # higher quality
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"
  case "$voice" in
    M|"") voice="onyx" ;;
    F)    voice="nova" ;;
  esac

  local base="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
  local model="${OPENAI_TTS_MODEL:-tts-1}"

  local payload
  payload=$(printf '{"model":"%s","input":"%s","voice":"%s","response_format":"mp3"}' \
    "$model" "$(echo "$text" | sed 's/"/\\"/g')" "$voice")

  curl -fsS -o "$out" -X POST "$base/audio/speech" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null
}
