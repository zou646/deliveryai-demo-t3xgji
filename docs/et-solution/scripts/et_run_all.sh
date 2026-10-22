#!/usr/bin/env bash
# et_run_all.sh — S+/X 两模式入口
# 用法：
#   S+ 模式（默认）: ./et_run_all.sh <url> <repo_root> <session_id> [headful]
#   X  模式       : ./et_run_all.sh <url> <repo_root> <session_id> [headful] --x
set -euo pipefail
URL="${1:?usage: et_run_all.sh <url> <repo_root> <session_id> [headful] [--x]}"
REPO="${2:?repo root required}"
SID="${3:?session id required}"
HEADFUL="${4:-headless}"
MODE="S+"
for arg in "$@"; do [[ "$arg" == "--x" ]] && MODE="X"; done
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$SCRIPT_DIR/../reports"
mkdir -p "$OUT/$SID"
CHARTER="$OUT/$SID/charter.json"

echo "========================================="
echo "ET 模式: $MODE  session=$SID  url=$URL"
echo "========================================="

echo "[1/5] 静态扫描 -> $OUT/$SID/expected.json"
python3 "$SCRIPT_DIR/et_static_expected.py" "$REPO" > "$OUT/$SID/expected.json"

echo "[2/5] 枚举初始页面 -> $OUT/$SID/inventory.json"
python3 "$SCRIPT_DIR/et_enumerate.py" "$URL" "$OUT/$SID/inventory.json"

echo "[3/5] Planner：请人工/Agent 填写 $CHARTER（可参考 templates/charter.json）"
if [ ! -f "$CHARTER" ]; then
  cp "$SCRIPT_DIR/../templates/charter.json" "$CHARTER"
  echo "[!] 已生成 charter 模板，请按实际 scope 修改后再启动 Executor+Monitor"
  echo "    修改后再跑一遍本脚本继续。"
  exit 0
fi

if [[ "$MODE" == "S+" ]]; then
  echo "[4/5] S+ 模式：启动 Executor(A) + Monitor 并行"
  # 简单并行：executor 前台，monitor 后台；用户 Ctrl+C 时一起结束
  python3 "$SCRIPT_DIR/et_monitor.py" --url "$URL" --charter "$CHARTER" --session-id "$SID" --out-dir "$OUT/$SID" --session a &
  MON_PID=$!
  trap "kill $MON_PID 2>/dev/null || true" EXIT
  HEADFUL_FLAG=""; [[ "$HEADFUL" == "headful" ]] && HEADFUL_FLAG="--headful"
  python3 "$SCRIPT_DIR/et_runner.py" "$URL" "${SID}_a" --out-dir "$OUT/$SID" $HEADFUL_FLAG
  wait $MON_PID || true
else
  echo "[4/5] X 模式：启动 Executor A + Executor B + Monitor A/B 并行"
  python3 "$SCRIPT_DIR/et_monitor.py" --url "$URL" --charter "$CHARTER" --session-id "$SID" --out-dir "$OUT/$SID" --session a &
  MON_A=$!
  python3 "$SCRIPT_DIR/et_monitor.py" --url "$URL" --charter "$CHARTER" --session-id "$SID" --out-dir "$OUT/$SID" --session b &
  MON_B=$!
  trap "kill $MON_A $MON_B 2>/dev/null || true" EXIT
  # X 模式两个 executor 串行（脚本简化；实际可并行用两个 browser context）
  HEADFUL_FLAG=""; [[ "$HEADFUL" == "headful" ]] && HEADFUL_FLAG="--headful"
  echo "  - Executor A"
  python3 "$SCRIPT_DIR/et_runner.py" "$URL" "${SID}_a" --out-dir "$OUT/$SID" $HEADFUL_FLAG
  echo "  - Executor B（重启 context 做红蓝对抗）"
  python3 "$SCRIPT_DIR/et_runner.py" "$URL" "${SID}_b" --out-dir "$OUT/$SID" $HEADFUL_FLAG
  wait $MON_A $MON_B || true
fi

echo "[5/5] 覆盖率 diff -> $OUT/$SID/coverage.md"
if [[ "$MODE" == "S+" ]]; then
  python3 "$SCRIPT_DIR/et_diff.py" "$OUT/$SID/expected.json" "$OUT/$SID/inventory.json" "$OUT/$SID/${SID}_a_summary.json" > "$OUT/$SID/coverage.md"
else
  # X 模式合并 a/b visited
  python3 - "$OUT/$SID/${SID}_a_summary.json" "$OUT/$SID/${SID}_b_summary.json" "$OUT/$SID/${SID}_merged_summary.json" <<'PY'
import json,sys,pathlib
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
merged={"session_id":a["session_id"]+"-merged","url":a["url"],
  "total_events":a["total_events"]+b["total_events"],
  "unique_elements":0,
  "visited_keys":sorted(set(a["visited_keys"])|set(b["visited_keys"])),
  "console_errors":a["console_errors"]+b["console_errors"],
  "console_warnings":a.get("console_warnings",[])+b.get("console_warnings",[])}
merged["unique_elements"]=len(merged["visited_keys"])
pathlib.Path(sys.argv[3]).write_text(json.dumps(merged,ensure_ascii=False,indent=2),encoding="utf-8")
PY
  python3 "$SCRIPT_DIR/et_diff.py" "$OUT/$SID/expected.json" "$OUT/$SID/inventory.json" "$OUT/$SID/${SID}_merged_summary.json" > "$OUT/$SID/coverage.md"
fi
echo "[done] 报告入口：$OUT/$SID/coverage.md"
