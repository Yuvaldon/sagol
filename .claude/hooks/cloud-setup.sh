#!/usr/bin/env bash
# SessionStart: prepares a cloud session (CLAUDE_CODE_REMOTE=true). Does nothing on a local machine.
# The cloud image ships Node 22; this project pins Node 24 with engine-strict, so Node comes from the
# npm registry (allowed under "Limited + package managers" network access). It goes into its own prefix,
# because a global install collides with the image's /opt/node22/bin/node, and reaches the session's
# shells through CLAUDE_ENV_FILE. Output goes to a log, not to Claude.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
log=/tmp/sagol-cloud-setup.log
version=$(cat .nvmrc)
prefix="$HOME/.local/node-$version"
if [ "$(node -p 'process.versions.node' 2>/dev/null)" != "$version" ]; then
  if [ ! -x "$prefix/bin/node" ]; then
    npm install -g --prefix "$prefix" "node@$version" >>"$log" 2>&1 ||
      { echo "Cloud setup: Node $version install failed, see $log" >&2; exit 0; }
  fi
  export PATH="$prefix/bin:$PATH"
  [ -n "$CLAUDE_ENV_FILE" ] && echo "export PATH=\"$prefix/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
fi
if [ ! -f node_modules/.package-lock.json ]; then
  npm ci >>"$log" 2>&1 || { echo "Cloud setup: npm ci failed, see $log" >&2; exit 0; }
fi
exit 0
