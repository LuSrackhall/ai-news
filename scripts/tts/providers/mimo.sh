#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# Mimo TTS provider — Xiaomi MiMo Token Plan
# With API Key Pool support for automatic rotation and rate limit handling
#
# Features:
#   - Multiple API keys (comma-separated pool)
#   - Automatic key rotation on 429 rate limit
#   - Retry mechanism with different keys
#   - Voice design mode for custom voices
#
# Env:     MIMO_API_KEY_POOL              required (comma-separated keys)
#          MIMO_BASE_URL                   optional (default: auto-detect)
#
# Podcast config (prefix: PODCAST_):
#          PODCAST_MIMO_TTS_MODEL          optional (default: mimo-v2.5-tts-voicedesign)
#          PODCAST_MIMO_TTS_FEMALE_VOICE_DESC  optional (voice design description)
#          PODCAST_MIMO_TTS_MALE_VOICE_DESC    optional (voice design description)
#          PODCAST_MIMO_TTS_VOICE          optional (preset voice, default: 冰糖)
#          PODCAST_MIMO_TTS_MALE_VOICE     optional (preset male voice, default: 白桦)
#          PODCAST_MIMO_TTS_FEMALE_VOICE   optional (preset female voice, default: 冰糖)
# ────────────────────────────────────────────────────────────────────

# Global variables for key pool management
KEY_POOL=()
CURRENT_KEY_INDEX=0
TOTAL_KEYS=0

# Initialize key pool from environment
_init_key_pool() {
  local pool="${MIMO_API_KEY_POOL:-}"

  if [[ -z "$pool" ]]; then
    echo "✗ MIMO_API_KEY_POOL is not set." >&2
    return 1
  fi

  # Split comma-separated keys into array (compatible with bash and zsh)
  KEY_POOL=()
  local old_ifs="$IFS"
  IFS=','
  for key in $pool; do
    KEY_POOL+=("$key")
  done
  IFS="$old_ifs"

  TOTAL_KEYS=${#KEY_POOL[@]}

  if [[ $TOTAL_KEYS -eq 0 ]]; then
    echo "✗ No API keys in pool." >&2
    return 1
  fi

  CURRENT_KEY_INDEX=0
  return 0
}

# Get next available key (round-robin)
_get_next_key() {
  if [[ $TOTAL_KEYS -eq 0 ]]; then
    _init_key_pool || return 1
  fi

  local key="${KEY_POOL[$CURRENT_KEY_INDEX]}"
  CURRENT_KEY_INDEX=$(( (CURRENT_KEY_INDEX + 1) % TOTAL_KEYS ))

  echo "$key"
}

# Reset key index (start from beginning)
_reset_key_pool() {
  CURRENT_KEY_INDEX=0
}

tts_check() {
  if ! command -v curl >/dev/null; then
    echo "✗ curl not found." >&2
    return 1
  fi
  if ! command -v jq >/dev/null; then
    echo "✗ jq is required to parse the API response." >&2
    return 1
  fi

  # Initialize key pool
  _init_key_pool || return 1

  # Test first key
  local test_key="${KEY_POOL[0]}"
  local base="${MIMO_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}"

  local resp
  resp=$(curl -s -w "\n%{http_code}" -X POST "$base/models" \
    -H "Authorization: Bearer $test_key" 2>/dev/null)

  local http_code
  http_code=$(echo "$resp" | tail -1)

  if [[ "$http_code" == "401" ]]; then
    echo "✗ Invalid API Key: ${test_key:0:15}..." >&2
    return 1
  fi

  echo "✓ API Key pool initialized: $TOTAL_KEYS key(s) available" >&2
  return 0
}

tts_install_help() {
  cat <<'EOF' >&2
To use Mimo TTS (Xiaomi Token Plan) for Podcast:

  export MIMO_API_KEY_POOL=key1,key2,key3
  (get keys at https://mimo.mi.com → Token Plan → Console)

Features:
  ✓ Multiple API keys for automatic rotation
  ✓ Handles 429 rate limits automatically
  ✓ Voice design mode for custom voices

Two modes available:

1. Preset Voice Mode (mimo-v2.5-tts):
   export PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts
   export PODCAST_MIMO_TTS_MALE_VOICE=白桦
   export PODCAST_MIMO_TTS_FEMALE_VOICE=冰糖

2. Voice Design Mode (mimo-v2.5-tts-voicedesign) - Recommended:
   export PODCAST_MIMO_TTS_MODEL=mimo-v2.5-tts-voicedesign
   export PODCAST_MIMO_TTS_MALE_VOICE_DESC="一个30岁的男性，声音温润磁性"
   export PODCAST_MIMO_TTS_FEMALE_VOICE_DESC="一个28岁的知性女性，声音温柔如水"

Available preset voices:
  冰糖, 茉莉, 苏打, 白桦, Mia, Chloe, Milo, Dean, mimo_default
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"

  local base="${MIMO_BASE_URL:-https://token-plan-cn.xiaomimimo.com/v1}"
  local model="${PODCAST_MIMO_TTS_MODEL:-mimo-v2.5-tts-voicedesign}"

  # Escape text for JSON
  local escaped_text
  escaped_text=$(echo "$text" | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/  */ /g')

  local payload=""

  if [[ "$model" == *"voicedesign"* ]]; then
    # Voice design mode
    local voice_desc=""

    if [[ "$voice" == "M" ]]; then
      voice_desc="${PODCAST_MIMO_TTS_MALE_VOICE_DESC:-一个30岁的男性，声音温润磁性，低沉有魅力，像大提琴般醇厚动听}"
    elif [[ "$voice" == "F" ]]; then
      voice_desc="${PODCAST_MIMO_TTS_FEMALE_VOICE_DESC:-一个28岁的知性女性，声音温柔如水，清澈悦耳，像春风拂面般舒适}"
    else
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
    # Preset voice mode
    local default_voice="${PODCAST_MIMO_TTS_VOICE:-冰糖}"
    local male_voice="${PODCAST_MIMO_TTS_MALE_VOICE:-白桦}"
    local female_voice="${PODCAST_MIMO_TTS_FEMALE_VOICE:-冰糖}"

    if [[ -z "$voice" ]]; then
      voice="$default_voice"
    fi

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

  # Try with key pool rotation on rate limits
  local max_retries=$TOTAL_KEYS
  local retry=0

  while [[ $retry -lt $max_retries ]]; do
    local current_key
    current_key=$(_get_next_key)

    local resp
    resp=$(curl -s -w "\n%{http_code}" -X POST "$base/chat/completions" \
      -H "Authorization: Bearer $current_key" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>/dev/null)

    local http_code
    http_code=$(echo "$resp" | tail -1)
    local body
    body=$(echo "$resp" | sed '$d')

    # Success
    if [[ "$http_code" == "200" ]]; then
      local audio_b64
      audio_b64=$(echo "$body" | jq -r '.choices[0].message.audio.data // empty') || return 1

      if [[ -n "$audio_b64" ]]; then
        echo "$audio_b64" | base64 -d > "$out" || return 1
        return 0
      fi
    fi

    # Rate limited (429), try next key
    if [[ "$http_code" == "429" ]]; then
      retry=$((retry + 1))
      if [[ $retry -lt $max_retries ]]; then
        # Silently retry with next key
        continue
      else
        echo "✗ All keys rate limited. Waiting 60s..." >&2
        sleep 60
        _reset_key_pool
        retry=0
        continue
      fi
    fi

    # Other errors
    echo "✗ API error (HTTP $http_code): $(echo "$body" | jq -r '.error.message // "Unknown error"')" >&2
    return 1
  done

  return 1
}
