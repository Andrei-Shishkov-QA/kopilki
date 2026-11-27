#!/usr/bin/env bash
# Собирает _site: основная (main), beta и все выпуски (теги v*). Запускается в GitHub Actions.
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
for t in $(git tag -l 'v*' --sort=-v:refname); do
  copy "$t" "_site/v/${t#v}"
  d=$(git log -1 --format=%cs "$t")
  [ $first -eq 1 ] || echo ',' >> _site/versions.json
  printf '{"version":"%s","date":"%s"}' "${t#v}" "$d" >> _site/versions.json
  first=0
done
echo ']' >> _site/versions.json
touch _site/.nojekyll
echo "Собрано: $(ls _site | tr '\n' ' ')"
