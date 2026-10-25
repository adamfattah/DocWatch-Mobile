#!/bin/zsh -l
cd "$(dirname "$0")"
xcrun simctl addmedia 5F68A740-684D-4719-ACDF-689D68CA9738 docwatch-test-card.jpg && echo ADDED > step9.log
