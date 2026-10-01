#!/usr/bin/env bash
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# workshop.env sets these only when a lab uses them; never take them from the caller's shell.
WORKSHOP_STANDALONE_LABS=''
WORKSHOP_PR_BASE_LABS=''
source "$HERE/lib/common.sh"
cd "$HERE/.."

USAGE="Usage: ./scripts/reset-lab.sh <lab number 1-${LAB_COUNT}> [--force]"
N="${1:-}"
[[ "$N" =~ ^[1-9][0-9]*$ ]] && [ "$N" -le "$LAB_COUNT" ] || die "$USAGE"
FORCE=0
[ "${2:-}" = "--force" ] && FORCE=1

# A standalone lab runs in a folder of its own, outside this repository: there is nothing to reset.
case " ${WORKSHOP_STANDALONE_LABS:-} " in
  *" ${N} "*)
    echo "Lab ${N} runs outside this repository. See its \"Before you start\" section."
    exit 0
    ;;
esac

TAG="lab-$N-start"
if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Fetching lab starting points…"
  git fetch --quiet "$UPSTREAM" 'refs/tags/lab-*:refs/tags/lab-*' ||
    die "Could not fetch the lab starting points from $UPSTREAM. Check your network and GitHub access."
fi

if [ -n "$(git status --porcelain)" ]; then
  if [ "$FORCE" = 1 ]; then
    git reset --quiet --hard
    git clean -fdq
  else
    {
      echo "You have uncommitted or untracked changes:"
      git status --short
      echo "Commit or stash them, or run again with --force to throw them away."
    } >&2
    exit 1
  fi
fi

OLD_LOCK="$(git rev-parse -q --verify HEAD:package-lock.json 2>/dev/null || true)"
if OLD_BRANCH="$(git rev-parse -q --verify "refs/heads/lab-$N")" &&
  [ "$OLD_BRANCH" != "$(git rev-parse "$TAG^{commit}")" ] &&
  ! git merge-base --is-ancestor "$OLD_BRANCH" "$TAG"; then
  BACKUP="lab-$N-backup-$(git rev-parse --short "$OLD_BRANCH")"
  git branch -f "$BACKUP" "$OLD_BRANCH"
  echo "Saved your previous lab-$N work on branch $BACKUP."
fi
git switch --quiet -C "lab-$N" "$TAG"
NEW_LOCK="$(git rev-parse -q --verify HEAD:package-lock.json 2>/dev/null || true)"

# A pull request lab (WORKSHOP_PR_BASE_LABS) compares with its own start: origin/HEAD points at origin/lab-N-base,
# written here from the tag, the commit seed-github.sh pushes, so /security-review sees only this lab's work.
# Any other lab puts back an origin/HEAD that one of these left. All local: nothing is fetched or pushed.
if git remote get-url origin >/dev/null 2>&1; then
  case " ${WORKSHOP_PR_BASE_LABS:-} " in
    *" ${N} "*)
      git update-ref "refs/remotes/origin/lab-$N-base" "$(git rev-parse "$TAG^{commit}")"
      git symbolic-ref refs/remotes/origin/HEAD "refs/remotes/origin/lab-$N-base"
      echo "Reviews of this branch (/security-review) now compare with the start of Lab ${N}."
      ;;
    *)
      case "$(git symbolic-ref -q refs/remotes/origin/HEAD || true)" in
        refs/remotes/origin/lab-*-base)
          if git rev-parse -q --verify refs/remotes/origin/main >/dev/null; then
            git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
          else
            git symbolic-ref --delete refs/remotes/origin/HEAD
          fi
          ;;
      esac
      ;;
  esac
fi

if [ "${WORKSHOP_SKIP_NPM:-0}" != 1 ]; then
  if [ ! -d node_modules ] || [ "$OLD_LOCK" != "$NEW_LOCK" ]; then npm install --no-audit --no-fund; fi
  npm run setup
fi

echo "You're at the start of Lab $N on branch lab-$N."
