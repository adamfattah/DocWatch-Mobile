#!/bin/zsh -l
# DocWatch-Mobile: re-apply native config (config plugins) + pod install. Log: step3.log
cd "$(dirname "$0")/app"
exec > >(tee ../step3.log) 2>&1
echo "== $(date)"
CI=1 npx expo prebuild -p ios --clean --no-install && echo PREBUILD_OK
(cd ios && pod install) && echo PODS_OK
grep -c SceneDelegate ios/docwatch.xcodeproj/project.pbxproj
grep -n "startReactNative" ios/docwatch/AppDelegate.swift
grep -n "UIApplicationSceneManifest" ios/docwatch/Info.plist
echo "== DONE"
