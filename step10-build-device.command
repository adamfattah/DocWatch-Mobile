#!/bin/zsh -l
# Signed development build for Adam's iPhone, installed and launched over USB.
# Runs in Terminal.app on purpose: directories created from inside Claude get the
# com.apple.provenance xattr, which every file inside inherits and codesign rejects.
# So app/ios is regenerated here and the build goes to Xcode's own DerivedData.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1
cd "$(dirname "$0")"
LOG="$PWD/step10.log"; : > "$LOG"
UDID=00008150-001569D12E6A401C
BID=com.adamfattah.docwatchmobile
DD="$HOME/Library/Developer/Xcode/DerivedData/docwatch-device"
cd app
if xattr -l ios 2>/dev/null | grep -q provenance; then
  echo "ios/ is provenance-tagged; regenerating it" | tee -a "$LOG"
  rm -rf ios
  ./node_modules/.bin/expo prebuild -p ios --clean 2>&1 | tee -a "$LOG" | grep -E "✔|✖|error" 
fi
cd ios
xcodebuild -workspace docwatch.xcworkspace -scheme docwatch -configuration Debug \
  -destination "id=$UDID" -derivedDataPath "$DD" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=HPAYZ6JQH6 build 2>&1 | tee -a "$LOG" | grep -E "error:|BUILD "
RC=${pipestatus[1]}
echo "BUILD EXIT $RC" | tee -a "$LOG"
if [ "$RC" = "0" ]; then
  APP="$DD/Build/Products/Debug-iphoneos/docwatch.app"
  xcrun devicectl device install app --device "$UDID" "$APP" 2>&1 | tee -a "$LOG" | tail -3
  echo "INSTALL EXIT ${pipestatus[1]}" | tee -a "$LOG"
  xcrun devicectl device process launch --device "$UDID" "$BID" --initialUrl "http://192.168.1.109:8081" 2>&1 | tee -a "$LOG" | tail -2
  echo "LAUNCH EXIT ${pipestatus[1]}" | tee -a "$LOG"
fi
echo; echo "Done - you can close this window."
