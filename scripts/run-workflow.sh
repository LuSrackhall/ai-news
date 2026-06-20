#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# run-workflow.sh -- AI 日报自动化工作流入口
#
# 用法：
#   bash scripts/run-workflow.sh              # 采集当天 AI 新闻
#   bash scripts/run-workflow.sh --date=2026-06-20  # 指定日期
#   bash scripts/run-workflow.sh --dry-run    # 只采集不生成内容
#   bash scripts/run-workflow.sh --history    # 查看历史日报索引
#
# 依赖：
#   - Node.js >= 18
#   - npm（用于依赖管理）
#
# 输出目录结构：
#   output/
#   ├── <YYYY-MM-DD>/
#   │   ├── raw/              # 原始采集数据
#   │   │   ├── huggingface.json
#   │   │   ├── github.json
#   │   │   ├── arxiv.json
#   │   │   ├── techcrunch.json
#   │   │   └── ...
#   │   ├── verified/         # 交叉验证后的数据
#   │   │   └── verified-news.json
#   │   ├── scored/           # 评分筛选后的数据
#   │   │   └── scored-news.json
#   │   ├── article.md        # 日报文章终稿
#   │   ├── script.md         # 视频口播稿
#   │   └── manifest.json     # 元数据（条目数、耗时、版本）
#   └── index.json            # 历史日报索引
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_ROOT="$PROJECT_ROOT/output"

# ── 默认值 ──
DATE="$(date +%Y-%m-%d)"
DRY_RUN=false
SHOW_HISTORY=false

for arg in "$@"; do
  case "$arg" in
    --date=*)
      DATE="${arg#--date=}"
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --history)
      SHOW_HISTORY=true
      ;;
    --help|-h)
      echo "用法：bash scripts/run-workflow.sh [--date=YYYY-MM-DD] [--dry-run] [--history]"
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
        console.log('  ' + e.date + '  ' + e.title + '  (' + e.newsCount + '条)');
      });
      console.log('共 ' + idx.entries.length + ' 期');
    "
  else
    echo "暂无历史日报。"
  fi
  exit 0
fi

# ── 准备输出目录 ──
DAY_DIR="$OUTPUT_ROOT/$DATE"
mkdir -p "$DAY_DIR/raw" "$DAY_DIR/verified" "$DAY_DIR/scored"

# ── 防重复检测 ──
if [[ -f "$DAY_DIR/article.md" ]]; then
  echo "警告：$DATE 的日报已存在。"
  read -rp "是否覆盖？(y/N) " confirm
  if [[ "$confirm" != [yY] ]]; then
    echo "已取消。"
    exit 0
  fi
fi

echo "========================================"
echo "  AI 日报工作流  $DATE"
echo "========================================"
echo ""

# ── 环境检测 ──
if ! command -v node >/dev/null; then
  echo "错误：需要 Node.js，请先安装。" >&2
  exit 1
fi

# 检查是否有 node_modules
if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
  echo "▸ 首次运行，安装依赖..."
  cd "$PROJECT_ROOT" && npm install
fi

if $DRY_RUN; then
  echo "[DRY RUN] 只执行采集阶段，不生成内容。"
  node "$PROJECT_ROOT/scripts/pipeline-runner.mjs" \
    --phase=collect \
    --date="$DATE" \
    --output="$DAY_DIR"
  echo ""
  echo "采集完成。数据在 $DAY_DIR/raw/"
  exit 0
fi

# ── 完整流水线 ──
START_TIME=$(date +%s)

node "$PROJECT_ROOT/scripts/pipeline-runner.mjs" \
  --phase=all \
  --date="$DATE" \
  --output="$DAY_DIR"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "========================================"
echo "  完成！耗时 ${DURATION}s"
echo "  输出目录：$DAY_DIR"
echo "========================================"
echo ""
echo "文件清单："
find "$DAY_DIR" -type f | sort | while read -r f; do
  echo "  $(basename "$f")  ($(wc -c < "$f" | tr -d ' ') bytes)"
done
