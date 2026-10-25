#!/bin/zsh -l
cd "$(dirname "$0")"
exec > >(tee step5.log) 2>&1
echo "== $(date)"
UDID=$(xcrun simctl create "iPhone 17 Pro (iOS 27)" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro com.apple.CoreSimulator.SimRuntime.iOS-27-0)
echo "created $UDID"
xcrun simctl boot "$UDID" && echo BOOTED
xcrun simctl list devices booted
echo "== DONE"
