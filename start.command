#!/bin/zsh
set -eu

SCRIPT_DIR="${0:A:h}"
PORT="5189"
URL="http://127.0.0.1:${PORT}"

cd "$SCRIPT_DIR"

if curl --silent --fail "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

(sleep 0.8; open "$URL") &
echo "课堂通知批量制作台已启动。"
echo "请保持这个窗口开启；关闭窗口即可停止本地工具。"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
