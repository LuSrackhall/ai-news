#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# MiniMax TTS provider — via mmx-cli
#
# 安装: npm install -g @anthropic-ai/mmx-cli  (或项目自带)
# Auth:  MINIMAX_API_KEY=...  或  mmx auth login --api-key ...
# Voices: male-cn / female-cn /Cute_Boy / Sweet_Girl 等
# ────────────────────────────────────────────────────────────────────

tts_check() {
  if ! command -v mmx >/dev/null 2>&1; then
    echo "✗ mmx-cli not found." >&2
    return 1
  fi
  if [[ -z "${MINIMAX_API_KEY:-}" ]] && ! mmx auth status >/dev/null 2>&1; then
    echo "✗ MiniMax not authenticated. Set MINIMAX_API_KEY or run: mmx auth login --api-key <key>" >&2
    return 1
  fi
}

tts_install_help() {
  cat <<'EOF' >&2
To use MiniMax TTS:

  npm install -g @anthropic-ai/mmx-cli
  export MINIMAX_API_KEY=your-key

Or login interactively:
  mmx auth login --api-key your-key
EOF
}

tts_synthesize() {
  local text="$1"
  local out="$2"
  local voice="${3:-}"
  case "$voice" in
    M|"") voice="male-cn" ;;
    F)    voice="female-cn" ;;
  esac

  mmx tts --text "$text" --voice "$voice" --output "$out" 2>/dev/null
}
