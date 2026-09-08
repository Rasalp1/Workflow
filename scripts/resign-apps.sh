#!/bin/bash
# Re-sign the Desktop launcher applets.
#
# Workflow.app is ad-hoc signed. Editing anything inside the bundle — Info.plist,
# Resources/Scripts/main.scpt (re-saving in Script Editor), or the icons —
# invalidates that signature. macOS TCC then cannot verify the app's identity, so
# every Apple Event it sends fails with:
#
#   execution error: Not authorised to send Apple events to System Events. (-1743)
#
# and no permission prompt is shown, no matter what is ticked in System Settings.
# The dev server runs as a child of this applet, so the applet is the TCC
# "responsible process" for the osascript calls in src/lib/terminalLauncher.ts.
#
# Re-signing changes the hashes, so it also invalidates any permission already
# granted to these apps. This script resets the Apple Events grant so macOS
# re-prompts; Accessibility must be refreshed by hand (System Settings ->
# Privacy & Security -> Accessibility: remove the entry with "-", re-add with "+").
#
# Run this after editing any applet, then relaunch and approve the prompts.

set -euo pipefail

APPS=(
  "$HOME/Desktop/Workflow.app"
  "$HOME/Desktop/Stop Workflow Server.app"
  "$HOME/Desktop/LeadGen.app"
  "$HOME/Desktop/Stop LeadGen Server.app"
)

for app in "${APPS[@]}"; do
  if [ ! -d "$app" ]; then
    echo "skip: $app (not found)"
    continue
  fi

  echo "==> $app"
  xattr -cr "$app" 2>/dev/null || true
  codesign --force --deep --sign - "$app"

  if codesign --verify --deep --strict "$app" 2>/dev/null; then
    echo "    signature valid"
  else
    echo "    SIGNATURE STILL INVALID" >&2
    exit 1
  fi

  bundle_id=$(codesign -dv "$app" 2>&1 | sed -n 's/^Identifier=//p')
  if [ -n "$bundle_id" ]; then
    # Drop the stale grant so macOS re-prompts against the new code hash.
    tccutil reset AppleEvents "$bundle_id" >/dev/null 2>&1 || true
    echo "    reset AppleEvents grant for $bundle_id"
  fi
done

echo
echo "Done. Relaunch the app and approve the 'wants to control System Events' prompt."
