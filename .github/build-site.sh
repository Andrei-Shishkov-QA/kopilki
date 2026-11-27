#!/usr/bin/env bash
# Собирает _site: основная (main), beta и все выпуски (ветки release/X.Y.Z). Запускается в GitHub Actions.
set -euo pipefail
rm -rf _site && mkdir -p _site
copy() {  # copy <ref> <папка>
  local tmp; tmp=$(mktemp -d)
  git archive "$1" | tar -x -C "$tmp"
  mkdir -p "$2" && cp -a "$tmp"/. "$2"/
  rm -rf "$2/.github" "$2/tests" && rm -rf "$tmp"
}
copy origin/main _site
if git rev-parse --verify -q origin/beta >/dev/null; then copy origin/beta _site/beta; fi
echo '[' > _site/versions.json
first=1
for r in $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/release/' | sort -t/ -k3 -V -r); do
  v=${r#origin/release/}
  copy "$r" "_site/v/$v"
  d=$(git log -1 --format=%cs "$r")
  [ $first -eq 1 ] || echo ',' >> _site/versions.json
  printf '{"version":"%s","date":"%s"}' "$v" "$d" >> _site/versions.json
  first=0
done
echo ']' >> _site/versions.json
touch _site/.nojekyll
echo "Собрано: $(ls _site | tr '\n' ' ')"
