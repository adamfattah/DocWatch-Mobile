#!/bin/zsh -l
cd "$(dirname "$0")"
exec > >(tee step8.log) 2>&1
echo "== $(date)"
firebase functions:list --project docwatch-mobile
firebase functions:log --project docwatch-mobile -n 40 2>&1 | tail -40
echo "== DONE"
