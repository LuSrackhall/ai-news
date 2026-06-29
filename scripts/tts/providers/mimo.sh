#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# Mimo TTS provider — Xiaomi MiMo Token Plan
# Podcast audio synthesis with custom voice design support
#
# Env:     MIMO_API_KEY                    required (shared with video skill)
#          MIMO_BASE_URL                   optional (default: auto-detect from key prefix)
#
# Podcast config (prefix: PODCAST_):
#          PODCAST_MIMO_TTS_MODEL          optional (default: mimo-v2.5-tts-voicedesign)
#            - mimo-v2.5-tts               : preset voices (冰糖/茉莉/苏打/白桦)
#            - mimo-v2.5-tts-voicedesign   : custom voice design (recommended)
#
# Preset voice mode (MODEL=mimo-v2.5-tts):
#          PODCAST_MIMO_TTS_VOICE           optional (default: 冰糖)
#          PODCAST_MIMO_TTS_MALE_VOICE      optional (default: 白桦)
#          PODCAST_MIMO_TTS_FEMALE_VOICE    optional (default: 冰糖)
#
# Voice design mode (MODEL=mimo-v2.5-tts-voicedesign):
#          PODCAST_MIMO_TTS_MALE_VOICE_DESC    optional (natural language description)
#          PODCAST_MIMO_TTS_FEMALE_VOICE_DESC  optional (natural language description)
#
# Voices (preset): 冰糖 / 茉莉 / 苏打 / 白桦 / Mia / Chloe / Milo / Dean / mimo_default
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
  (get one at https://mimo.mi.com)

Two modes available:

1. Preset Voice Mode (mimo-v2.5-tts):
   export PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts
   export PODCAST_MIMO_TTS_MALE_VOICE=白桦
   export PODCAST_MIMO_TTS_FEMALE_VOICE=冰糖

2. Voice Design Mode (mimo-v2.5-tts-voicedesign) - Recommended:
   export PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts-voicedesign
   export PODCAST_MIMO_TTS_MALE_VOICE_DESC="一个30岁的男性，声音温润磁性，像大提琴般醇厚"
   export PODCAST_MIMO_TTS_FEMALE_VOICE_DESC="一个28岁的知性女性，声音温柔如水，清澈悦耳"

Available preset voices:
  冰糖, 茉莉, 苏打, 白桦, Mia, Chloe, Milo, Dean, mimo_default

Note: Voice design mode creates custom voices from natural language descriptions
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  local base="${MIMO_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}"
  local model="${PODCAST_MIMO_TTS_MODEL:-mimo-v2.5-tts-voicedesign}"

  # Escape text for JSON: escape double quotes and newlines
  local escaped_text
  escaped_text=$(echo "$text" | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/  */ /g')

  local payload=""

  if [[ "$model" == *"voicedesign"* ]]; then
    # Voice design mode: use natural language descriptions
    local voice_desc=""

    if [[ "$voice" == "M" ]]; then
      voice_desc="${PODCAST_MIMO_TTS_MALE_VOICE_DESC:-一个30岁的男性，声音温润磁性，低沉有魅力，像大提琴般醇厚动听}"
    elif [[ "$voice" == "F" ]]; then
      voice_desc="${PODCAST_MIMO_TTS_FEMALE_VOICE_DESC:-一个28岁的知性女性，声音温柔如水，清澈悦耳，像春风拂面般舒适}"
    else
      # Default to female voice
      voice_desc="${PODCAST_MIMO_TTS_FEMALE_VOICE_DESC:-一个28岁的知性女性，声音温柔如水，清澈悦耳，像春风拂面般舒适}"
    fi

    payload=$(cat <<EOF
{
  "model": "$model",
  "messages": [
    {"role": "user", "content": "$voice_desc"},
    {"role": "assistant", "content": "$escaped_text"}
  ],
  "audio": {
    "format": "mp3"
  }
}
EOF
)
  else
    # Preset voice mode: use predefined voice names
    local default_voice="${PODCAST_MIMO_TTS_VOICE:-冰糖}"
    local male_voice="${PODCAST_MIMO_TTS_MALE_VOICE:-白桦}"
    local female_voice="${PODCAST_MIMO_TTS_FEMALE_VOICE:-冰糖}"

    # Default voice from podcast config
    if [[ -z "$voice" ]]; then
      voice="$default_voice"
    fi

    # Map M/F to podcast voices
    case "$voice" in
      M) voice="$male_voice" ;;
      F) voice="$female_voice" ;;
    esac

    local style="${PODCAST_MIMO_TTS_STYLE:-}"

    if [[ -n "$style" ]]; then
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
    else
      payload=$(cat <<EOF
{
  "model": "$model",
  "messages": [
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
    fi
  fi

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
    return 1
  fi

  echo "$audio_b64" | base64 -d > "$out" || return 1
}
