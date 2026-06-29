#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# Mimo TTS provider — Xiaomi Mimo Token Plan
# Podcast audio synthesis with male/female host voice support
#
# Env:     MIMO_API_KEY                required (shared with video skill)
#          MIMO_BASE_URL               optional (default: https://token-plan-cn.xiaomimimo.com/v1)
#          MIMO_TTS_MODEL              optional (default: mimo-v2.5-tts)
#
# Podcast-specific voice config (prefix: PODCAST_):
#          PODCAST_MIMO_TTS_VOICE      optional (default: 苏打)
#          PODCAST_MIMO_TTS_MALE_VOICE optional (default: Dean)
#          PODCAST_MIMO_TTS_FEMALE_VOICE optional (default: 苏打)
#          PODCAST_MIMO_TTS_STYLE      optional (default: 新闻播报风格，语速适中，沉稳大气)
#
# Voices:  苏打 / 冰糖 / 茉莉 / 白桦 / Mia / Chloe / Milo / Dean / mimo_default
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if ! command -v curl >/dev/null; then
    echo "✗ curl not found." >&2
    return 1
  fi
  if ! command -v jq >/dev/null; then
    echo "✗ jq is required to parse the API response." >&2
    return 1
  fi
  if [[ -z "${MIMO_API_KEY:-}" ]]; then
    echo "✗ MIMO_API_KEY is not set." >&2
    return 1
  fi
}

tts_install_help() {
  cat <<'EOF' >&2
To use Mimo TTS (Xiaomi Token Plan) for Podcast:

  export MIMO_API_KEY=your-mimo-api-key
  (get one at https://token-plan-cn.xiaomimimo.com)

Required:
  export MIMO_API_KEY=tp-... or sk-...

Optional (podcast-specific):
  export PODCAST_MIMO_TTS_VOICE=苏打           # default voice
  export PODCAST_MIMO_TTS_MALE_VOICE=Dean      # male host voice (M)
  export PODCAST_MIMO_TTS_FEMALE_VOICE=苏打    # female host voice (F)
  export PODCAST_MIMO_TTS_STYLE="新闻播报风格，语速适中，沉稳大气"

Optional (general):
  export MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
  export MIMO_TTS_MODEL=mimo-v2.5-tts

Available voices:
  苏打, 冰糖, 茉莉, 白桦, Mia, Chloe, Milo, Dean, mimo_default

Voice mapping for podcast:
  M (male host)   -> PODCAST_MIMO_TTS_MALE_VOICE (default: Dean)
  F (female host) -> PODCAST_MIMO_TTS_FEMALE_VOICE (default: 苏打)

Note: Uses PODCAST_ prefix to avoid conflict with video skill's MIMO_TTS_* config
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  local base="${MIMO_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}"
  local model="${MIMO_TTS_MODEL:-mimo-v2.5-tts}"

  # Use podcast-specific env vars, fallback to generic or default
  local default_voice="${PODCAST_MIMO_TTS_VOICE:-苏打}"
  local male_voice="${PODCAST_MIMO_TTS_MALE_VOICE:-Dean}"
  local female_voice="${PODCAST_MIMO_TTS_FEMALE_VOICE:-苏打}"

  # Default voice from podcast config
  if [[ -z "$voice" ]]; then
    voice="$default_voice"
  fi

  # Map M/F to podcast voices
  case "$voice" in
    M) voice="$male_voice" ;;
    F) voice="$female_voice" ;;
  esac

  # Escape text for JSON: escape double quotes and newlines
  local escaped_text
  escaped_text=$(echo "$text" | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/  */ /g')

  # Get podcast style instruction
  local style="${PODCAST_MIMO_TTS_STYLE:-新闻播报风格，语速适中，沉稳大气}"

  local payload
  payload=$(cat <<EOF
{
  "model": "$model",
  "messages": [
    {"role": "user", "content": "$style"},
    {"role": "assistant", "content": "$escaped_text"}
  ],
  "modalities": ["text", "audio"],
  "audio": {
    "voice": "$voice",
    "format": "mp3"
  }
}
EOF
)

  local tmpwav
  tmpwav=$(mktemp -t mimo_tts).wav

  # curl the API; response JSON has choices[0].message.audio.data (base64 mp3)
  local resp
  resp=$(curl -fsS -X POST "$base/chat/completions" \
    -H "Authorization: Bearer $MIMO_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null) || return 1

  # Extract base64 audio data and decode to mp3
  local audio_b64
  audio_b64=$(echo "$resp" | jq -r '.choices[0].message.audio.data // empty') || return 1

  if [[ -z "$audio_b64" ]]; then
    echo "✗ MiMo API returned no audio data." >&2
    rm -f "$tmpwav"
    return 1
  fi

  echo "$audio_b64" | base64 -d > "$out" || return 1
}
