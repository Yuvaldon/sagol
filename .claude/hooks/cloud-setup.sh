#!/usr/bin/env bash
# SessionStart: prepares a cloud session (CLAUDE_CODE_REMOTE=true). Does nothing on a local machine.
# The cloud image ships Node 22; this project pins Node 24 with engine-strict, so Node comes from the
# npm registry (allowed under "Limited + package managers" network access). Output goes to a log, not to Claude.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
log=/tmp/sagol-cloud-setup.log
want=$(cut -d. -f1 .nvmrc)
if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" != "$want" ]; then
  npm install -g "node@$(cat .nvmrc)" >>"$log" 2>&1 || { echo "Cloud setup: Node $(cat .nvmrc) install failed, see $log" >&2; exit 0; }
  hash -r
fi
if [ ! -d node_modules ]; then
  npm ci >>"$log" 2>&1 || { echo "Cloud setup: npm ci failed, see $log" >&2; exit 0; }
fi
exit 0
