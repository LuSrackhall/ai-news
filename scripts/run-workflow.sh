#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# run-workflow.sh -- AI 日报 Pipeline v3 入口
#
# 用法：
#   bash scripts/run-workflow.sh              # 生成当天日报
#   bash scripts/run-workflow.sh --date=2026-06-22  # 指定日期
#   bash scripts/run-workflow.sh --history    # 查看历史日报索引
#
# Pipeline v3: 8 阶段混合流水线（代码驱动 + LLM 语义选题/生成）
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_ROOT="$PROJECT_ROOT/output"

DATE="$(date +%Y-%m-%d)"
SHOW_HISTORY=false

for arg in "$@"; do
  case "$arg" in
    --date=*)
      DATE="${arg#--date=}"
      ;;
    --history)
      SHOW_HISTORY=true
      ;;
    --help|-h)
      echo "用法：bash scripts/run-workflow.sh [--date=YYYY-MM-DD] [--history]"
      echo ""
      echo "Pipeline v3: RSS采集 → URL验证 → 评分去重 → LLM选题 → LLM生成 → 渲染 → 校验 → 归档"
      exit 0
      ;;
    *)
      echo "未知参数: $arg" >&2
      exit 1
      ;;
  esac
done

# ── 历史索引 ──
if $SHOW_HISTORY; then
  INDEX_FILE="$OUTPUT_ROOT/index.json"
  if [[ -f "$INDEX_FILE" ]]; then
    echo "=== 历史日报索引 ==="
    node -e "
      const idx = JSON.parse(require('fs').readFileSync('$INDEX_FILE','utf8'));
      idx.entries.forEach(e => {
        console.log('  ' + e.date + '  ' + (e.selected_count || '?') + '条  v' + (e.pipeline_version || '?'));
      });
      console.log('共 ' + idx.entries.length + ' 期');
    "
  else
    echo "暂无历史日报。"
  fi
  exit 0
fi

# ── 环境检测 ──
if ! command -v node >/dev/null; then
  echo "错误：需要 Node.js >= 18，请先安装。" >&2
  exit 1
fi

# ── 防重复检测 ──
DAY_DIR="$OUTPUT_ROOT/$DATE"
if [[ -f "$DAY_DIR/article.md" ]]; then
  echo "警告：$DATE 的日报已存在。"
  read -rp "是否覆盖？(y/N) " confirm
  if [[ "$confirm" != [yY] ]]; then
    echo "已取消。"
    exit 0
  fi
fi

echo "========================================"
echo "  AI 日报 Pipeline v3 | $DATE"
echo "========================================"
echo ""

# ── 运行采集脚本（Phase 1-3 由脚本执行，Phase 4-8 由 Workflow 驱动）──
START_TIME=$(date +%s)

# Phase 1: RSS 采集
echo "📡 Phase 1: RSS 采集..."
node "$PROJECT_ROOT/scripts/collect-rss.mjs" --date="$DATE"

# Phase 2: URL 验证
echo ""
echo "🔗 Phase 2: URL 验证..."
node "$PROJECT_ROOT/scripts/verify-urls.mjs" --date="$DATE"

# Phase 3-8: 通过 Workflow agent 执行
echo ""
echo "⚙️ Phase 3-8: 确定性处理 + LLM 选题/生成 + 渲染 + 校验 + 归档..."
echo "（请通过 Claude Code Workflow 执行 ai-ribao-daily）"
echo ""
echo "已完成 Phase 1-2（代码执行）。"
echo "Phase 3-8 需要通过 Claude Code 的 ai-ribao-daily workflow 执行。"
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "Phase 1-2 耗时: ${DURATION}s"
