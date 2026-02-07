#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== bun-ipfs integration test ==="
echo ""

echo "[1/7] Push ./upload/attention (QR codes shown by default)"
bun run src/index.ts ./upload/attention
echo ""

echo "[2/7] Push ./upload/attention without QR codes"
bun run src/index.ts ./upload/attention --no-qr
echo ""

echo "[3/7] List push history"
bun run src/index.ts history
echo ""

echo "[4/7] Search for 'attention'"
bun run src/index.ts find attention
echo ""

echo "[5/7] Ping IPFS nodes"
bun run src/index.ts ping
echo ""

echo "[6/7] Show environment"
bun run src/index.ts env
echo ""

echo "[7/7] Test from different directory with absolute path"
cd /tmp
"$PROJECT_DIR/src/index.ts" "$PROJECT_DIR/upload/attention" --no-qr
cd "$PROJECT_DIR"
echo ""

echo "=== All tests passed ==="
echo ""
echo "State directory: ~/.local/store/bun-ipfs/"
echo "Reports saved to: $(pwd)/"
