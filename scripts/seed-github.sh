#!/usr/bin/env bash
# Seeds your copy of the workshop repository on GitHub with what the labs use:
#   scripts/seed/labels.tsv     labels to create (name, colour, description; tab-separated), optional
#   scripts/seed/issues/*.md    one issue per file, in file-name order
#   scripts/seed/pr-*.md        one draft pull request per file, optional
#   WORKSHOP_PR_BASE_LABS       (scripts/workshop.env) for each lab N listed, a branch lab-N-base at lab-N-start, the
#                               base of that lab's pull request; reset-lab.sh points origin/HEAD at it
# Each issue or pull request file starts with front matter:
#   ---
#   title: Invalid task id returns 500 instead of 400
#   labels: bug,api            (issues; optional)
#   branch: feature-x          (pull requests: the workshop ref the branch is pushed from, a tag of the same name)
#   ---
# and the rest of the file is the body. {{REPO}} in a body becomes your owner/repo.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# workshop.env sets this only when a lab uses it; never take it from the caller's shell.
WORKSHOP_PR_BASE_LABS=''
source "$HERE/lib/common.sh"
cd "$HERE/.."

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
run() { if [ "$DRY" = 1 ]; then printf '+ %s\n' "$*"; else "$@" >/dev/null; fi; }

# front_matter KEY FILE: the value of KEY in FILE's front matter (empty when absent).
front_matter() { awk -v key="$1" 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit } NR > 1 && index($0, key ": ") == 1 { print substr($0, length(key) + 3); exit }' "$2"; }
# body FILE: everything after the front matter, from its first non-blank line.
body() { awk 'n >= 2 { if (!started && $0 == "") next; started = 1; print; next } $0 == "---" { n++ }' "$1"; }

SEED=scripts/seed
ISSUES=()
for file in "$SEED"/issues/*.md; do [ -f "$file" ] && ISSUES+=("$file"); done
PRS=()
for file in "$SEED"/pr-*.md; do [ -f "$file" ] && PRS+=("$file"); done
BASES=()
for n in ${WORKSHOP_PR_BASE_LABS:-}; do BASES+=("$n"); done
if [ "${#ISSUES[@]}" = 0 ] && [ "${#PRS[@]}" = 0 ] && [ "${#BASES[@]}" = 0 ]; then
  echo "Nothing to seed: this workshop has no issues, pull requests or pull request labs."
  exit 0
fi

for file in ${ISSUES[@]+"${ISSUES[@]}"} ${PRS[@]+"${PRS[@]}"}; do
  [ -n "$(front_matter title "$file")" ] || die "$file has no title in its front matter."
done
for file in ${PRS[@]+"${PRS[@]}"}; do
  [ -n "$(front_matter branch "$file")" ] || die "$file has no branch in its front matter."
done

command -v gh >/dev/null 2>&1 || die "The GitHub CLI (gh) is not installed. See https://cli.github.com, then run: gh auth login"
gh auth status >/dev/null 2>&1 || die "The GitHub CLI is not signed in. Run: gh auth login"

ORIGIN_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
[ -n "$ORIGIN_URL" ] || die "No origin remote. Follow the README steps to create your own copy first."
REPO="$(printf '%s\n' "$ORIGIN_URL" | sed -E 's#^(https?://([^/@]*@)?[^/]+/|ssh://([^/@]*@)?[^/]+/|[^/@]*@[^:/]+:)##; s#/+$##; s#\.git$##')"
case "$REPO" in
  */*) ;;
  *) die "Could not work out your GitHub repository from the origin remote ($ORIGIN_URL). Follow the README steps to create your own copy first." ;;
esac
if [ "$REPO" = "$UPSTREAM_REPO" ]; then
  die "This is the workshop repository itself. Create your own copy first (see README.md), then run this inside it."
fi
unreachable() { die "Could not reach GitHub for $REPO. Check: gh auth status"; }
run gh repo set-default "$REPO" || unreachable
echo "Seeding ${REPO}…"

# Before changing anything: each pull request's branch must exist upstream and sit on your main.
PR_NUMBERS=()
for file in ${PRS[@]+"${PRS[@]}"}; do
  branch="$(front_matter branch "$file")"
  number="$(gh pr list -R "$REPO" --state all --head "$branch" --json number --jq '.[].number')" || unreachable
  PR_NUMBERS+=("${number:-none}")
  [ -n "$number" ] && continue
  if ! git rev-parse -q --verify "refs/tags/$branch" >/dev/null; then
    git fetch --quiet "$UPSTREAM" "refs/tags/$branch:refs/tags/$branch" ||
      die "Could not fetch the $branch branch from $UPSTREAM. Check your network and GitHub access, then run this again."
  fi
  git fetch --quiet origin main 2>/dev/null || true
  if ! git merge-base --is-ancestor "$(git rev-parse "refs/tags/$branch^{commit}")~1" origin/main 2>/dev/null; then
    die "Your copy doesn't share history with the workshop repository, so the $branch pull request can't be opened. Recreate your copy with the steps in README.md (clone, then gh repo create --source .), then run this again."
  fi
done

# Before changing anything: each pull request lab's start must be here, no tag may have its base branch's name, and it
# must share history with your main (a common ancestor: your main may have moved on, for example by a merged PR).
BASE_EXISTS=()
for n in ${BASES[@]+"${BASES[@]}"}; do
  tag="lab-$n-start"
  base="lab-$n-base"
  if git rev-parse -q --verify "refs/tags/$base" >/dev/null; then
    die "Your copy has a tag named $base, the name of the branch Lab ${n}'s pull request is based on. Delete the tag with: git tag -d $base. Then run this again."
  fi
  if ! git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    git fetch --quiet "$UPSTREAM" "refs/tags/$tag:refs/tags/$tag" ||
      die "Could not fetch $tag from $UPSTREAM. Check your network and GitHub access, then run this again."
  fi
  git fetch --quiet origin main 2>/dev/null || true
  if ! git merge-base "refs/tags/$tag^{commit}" origin/main >/dev/null 2>&1; then
    die "Your copy doesn't share history with the workshop repository, so the $base branch can't be created. Recreate your copy with the steps in README.md (clone, then gh repo create --source .), then run this again."
  fi
  exists="$(git ls-remote origin "refs/heads/$base")" || unreachable
  if [ -n "$exists" ]; then BASE_EXISTS+=(yes); else BASE_EXISTS+=(no); fi
done

if [ -f "$SEED/labels.tsv" ]; then
  while IFS=$'\t' read -r name color description; do
    [ -z "$name" ] && continue
    run gh label create -R "$REPO" "$name" --color "$color" --description "$description" --force
  done < "$SEED/labels.tsv"
fi

if [ "${#ISSUES[@]}" -gt 0 ]; then
  EXISTING="$(gh issue list -R "$REPO" --state all --limit 200 --json title --jq '.[].title')" || unreachable
fi
for file in ${ISSUES[@]+"${ISSUES[@]}"}; do
  title="$(front_matter title "$file")"
  labels="$(front_matter labels "$file")"
  text="$(body "$file" | sed "s#{{REPO}}#$REPO#g")"
  if grep -Fxq -- "$title" <<<"$EXISTING"; then
    echo "  issue already exists: $title"
    continue
  fi
  if [ -n "$labels" ]; then
    run gh issue create -R "$REPO" --title "$title" --label "$labels" --body "$text"
  else
    run gh issue create -R "$REPO" --title "$title" --body "$text"
  fi
  if [ "$DRY" = 1 ]; then echo "  would create issue: $title"; else echo "  created issue: $title"; fi
done

i=0
for n in ${BASES[@]+"${BASES[@]}"}; do
  base="lab-$n-base"
  exists="${BASE_EXISTS[$i]}"
  i=$((i + 1))
  if [ "$exists" = yes ]; then
    echo "  branch already exists: $base"
    continue
  fi
  run git push origin --quiet "refs/tags/lab-$n-start^{commit}:refs/heads/$base"
  if [ "$DRY" = 1 ]; then echo "  would create branch: $base"; else echo "  created branch: $base"; fi
done

i=0
for file in ${PRS[@]+"${PRS[@]}"}; do
  title="$(front_matter title "$file")"
  branch="$(front_matter branch "$file")"
  number="${PR_NUMBERS[$i]}"
  i=$((i + 1))
  if [ "$number" != none ]; then
    echo "  pull request already exists: $title (#$number)"
    continue
  fi
  run git push origin --quiet "refs/tags/$branch^{commit}:refs/heads/$branch"
  run gh pr create -R "$REPO" --draft --base main --head "$branch" --title "$title" --body "$(body "$file" | sed "s#{{REPO}}#$REPO#g")"
  if [ "$DRY" = 1 ]; then echo "  would create draft pull request: $title"; else echo "  created draft pull request: $title"; fi
done

if [ "$DRY" = 1 ]; then
  echo "Dry run: nothing was changed."
else
  gh issue list -R "$REPO" --state open
  echo "Seeded. The workshop issues and pull requests are ready."
fi
