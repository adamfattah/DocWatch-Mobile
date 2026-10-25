#!/bin/zsh -l
# DocWatch-Mobile: generate ios/ project + pods, then open in Xcode. Log: step2.log
cd "$(dirname "$0")/app"
exec > >(tee ../step2.log) 2>&1
echo "== $(date)"
npx expo install expo-build-properties 2>&1 | tail -3
npx expo config --type public | grep -E "bundleIdentifier|iosUrlScheme|projectId" 
CI=1 npx expo prebuild -p ios --clean && echo PREBUILD_OK
ls ios
open ios/*.xcworkspace && echo OPENED
echo "== DONE"
