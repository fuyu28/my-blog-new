#!/usr/bin/env bash
set -euo pipefail

# --- env var チェック ---
if [[ -z "${SSH_PRIVATE_KEY-}" ]]; then
  echo "SSH_PRIVATE_KEY is MISSING in this build environment"
  exit 1
fi
echo "SSH_PRIVATE_KEY is PRESENT (length=${#SSH_PRIVATE_KEY})"

# --- SSH セットアップ ---
mkdir -p ~/.ssh
chmod 700 ~/.ssh

printf "%s\n" "$SSH_PRIVATE_KEY" >~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519

ssh-keyscan -t ed25519 github.com >~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts

# --- クローン ---
clone_repo() {
  local repo="$1" dest="$2"
  rm -rf "$dest"
  GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes' \
    git clone --depth=1 "$repo" "$dest"
}

CONTENT_DIR="${CONTENT_DIR:-my-blog-contents}"
clone_repo git@github.com:fuyu28/my-blog-contents.git "$CONTENT_DIR"

# --- 依存 & ビルド ---
bun install --frozen-lockfile
bun run build:worker
