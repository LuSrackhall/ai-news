# ────────────────────────────────────────────────────────────────────
# Xiaomi MiMo TTS provider — uses MiMo-V2.5-TTS chat completions API.
#
# Supports both Pay-as-you-go and Token Plan:
#   - Pay-as-you-go: MIMO_API_KEY starts with sk- (default base URL)
#   - Token Plan:    MIMO_API_KEY starts with tp- (auto-detects cluster)
#   - Override:      MIMO_BASE_URL=... (explicit base URL)
#
# Docs:    https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5
# Token:   https://mimo.mi.com/docs/zh-CN/tokenplan/Token Plan/quick-access
# Env:     MIMO_API_KEY=...         required (sk- or tp- prefix)
#          MIMO_BASE_URL=...        optional — overrides auto-detection
#          MIMO_TTS_STYLE=...       optional — default style instruction for all segments
#          MIMO_TTS_VOICE=...       optional — default voice (冰糖 / 茉莉 / 苏打 / 白桦)
# Voices:  冰糖 (female, default) / 茉莉 (female) / 苏打 (male) / 白桦 (male)
# Output:  API returns base64-encoded WAV; ffmpeg converts to mp3.
#
# Style control: put natural-language style instructions in the `user` role.
#   e.g. "新闻主播风格，语速适中，沉稳大气"
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if ! command -v curl >/dev/null; then
    echo "✗ curl not found in PATH." >&2
    return 1
  fi
  if ! command -v jq >/dev/null; then
    echo "✗ jq is required to parse the API response." >&2
    return 1
  fi
  if ! command -v ffmpeg >/dev/null; then
    echo "✗ ffmpeg is required to convert wav→mp3 (brew install ffmpeg)." >&2
    return 1
  fi
  if [[ -z "${MIMO_API_KEY:-}" ]]; then
    echo "✗ MIMO_API_KEY is not set." >&2
    return 1
  fi
}

tts_install_help() {
  cat <<'EOF' >&2
To use the Xiaomi MiMo TTS provider:

  Pay-as-you-go (sk-xxxxx):
    export MIMO_API_KEY=sk-...
    (get one at https://mimo.mi.com → API Keys)

  Token Plan (tp-xxxxx):
    export MIMO_API_KEY=tp-...
    (get one at https://mimo.mi.com → Token Plan → Console)
    Base URL auto-detected from key prefix (China cluster default).

  Optional:
    export MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1  # override
    export MIMO_TTS_VOICE=苏打        # default: 冰糖
    export MIMO_TTS_STYLE="新闻主播风格，沉稳大气"

Install deps (only if missing):
  curl    — brew install curl
  jq      — brew install jq
  ffmpeg  — brew install ffmpeg

Available voices (Chinese):
  冰糖 (female, default) / 茉莉 (female) / 苏打 (male) / 白桦 (male)

Or pick another provider:  PRESENTATION_TTS=<name> npm run synthesize-audio
EOF
}

# Resolve base URL: explicit override > auto-detect from key prefix
_mimo_base_url() {
  if [[ -n "${MIMO_BASE_URL:-}" ]]; then
    echo "$MIMO_BASE_URL"
    return
  fi
  local key="${MIMO_API_KEY:-}"
  if [[ "$key" == tp-* ]]; then
    echo "https://token-plan-cn.xiaomimimo.com/v1"
  else
    echo "https://api.xiaomimimo.com/v1"
  fi
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"
  [[ -z "$voice" ]] && voice="${MIMO_TTS_VOICE:-冰糖}"

  local style="${MIMO_TTS_STYLE:-}"
  local base
  base="$(_mimo_base_url)"

  # Build messages array.
  #   role:user   = style instruction (optional)
  #   role:assistant = text to synthesize (required, per MiMo API spec)
  local messages
  if [[ -n "$style" ]]; then
    messages=$(jq -n \
      --arg s "$style" \
      --arg t "$text" \
      '[{role:"user",content:$s},{role:"assistant",content:$t}]')
  else
    messages=$(jq -n \
      --arg t "$text" \
      '[{role:"assistant",content:$t}]')
  fi

  local payload
  payload=$(jq -n \
    --arg m "mimo-v2.5-tts" \
    --arg v "$voice" \
    --argjson msgs "$messages" \
    '{model:$m, messages:$msgs, audio:{format:"wav",voice:$v}}')

  local tmpwav
  tmpwav=$(mktemp -t mimo_tts).wav

  # curl the API; response JSON has choices[0].message.audio.data (base64 wav)
  local resp
  resp=$(curl -fsS -X POST "$base/chat/completions" \
    -H "api-key: $MIMO_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null) || return 1

  # Extract base64 audio data and decode to wav
  local audio_b64
  audio_b64=$(echo "$resp" | jq -r '.choices[0].message.audio.data // empty') || return 1

  if [[ -z "$audio_b64" ]]; then
    echo "✗ MiMo API returned no audio data." >&2
    rm -f "$tmpwav"
    return 1
  fi

  echo "$audio_b64" | base64 -d > "$tmpwav" || { rm -f "$tmpwav"; return 1; }

  # Convert wav → mp3
  ffmpeg -y -i "$tmpwav" -codec:a libmp3lame -qscale:a 2 "$out" >/dev/null 2>&1
  local code=$?
  rm -f "$tmpwav"
  return $code
}
