#!/bin/zsh -l
# DocWatch-Mobile: check Mac toolchain + install JS deps. Log: step1.log
cd "$(dirname "$0")"
exec > >(tee step1.log) 2>&1
echo "== $(date) in $(pwd)"
echo "-- tools"; sw_vers; xcode-select -p; xcodebuild -version
for t in node npm npx pod brew git firebase gcloud eas; do printf "%s: " $t; command -v $t || echo MISSING; done
node -v; pod --version 2>/dev/null
xcrun simctl list runtimes 2>&1 | tail -5
echo "-- npm install (app)"; (cd app && npm install --no-audit --no-fund) && echo APP_INSTALL_OK
echo "-- npm install (functions)"; (cd functions && npm install --no-audit --no-fund && npm run build) && echo FN_BUILD_OK
echo "== DONE"
