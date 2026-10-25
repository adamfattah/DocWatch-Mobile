#!/bin/zsh -l
# Starts the Metro JS bundler for the docwatch dev build. Leave this window open while testing.
cd "$(dirname "$0")/app"
npx expo start --dev-client 2>&1 | tee ../metro.log
