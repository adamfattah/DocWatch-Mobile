#!/bin/zsh -l
# DocWatch-Mobile: deploy Firestore + Storage rules and Cloud Functions to docwatch-mobile. Log: step4.log
cd "$(dirname "$0")"
exec > >(tee step4.log) 2>&1
echo "== $(date)"
firebase login:list
(cd functions && npm run build) || exit 1
firebase deploy --only firestore,storage,functions --project docwatch-mobile --non-interactive --force && echo DEPLOY_OK
echo "== DONE"
