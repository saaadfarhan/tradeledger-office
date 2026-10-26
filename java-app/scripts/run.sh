#!/usr/bin/env bash
set -eu
project_root="$(cd "$(dirname "$0")/.." && pwd)"
"$project_root/scripts/test.sh" >/dev/null

# Swing is an X11 application. Under Sway it runs through XWayland, whose
# window manager is non-reparenting. This variable tells Java AWT that fact.
if [ "${XDG_SESSION_TYPE-}" = "wayland" ]; then
    if [ -z "${DISPLAY-}" ]; then
        echo "Error: Wayland session has no DISPLAY for XWayland." >&2
        echo "Enable XWayland in Sway and start this script from that session." >&2
        exit 1
    fi
    export _JAVA_AWT_WM_NONREPARENTING=1
fi

java -cp "$project_root/build/classes" com.purchasesale.ui.Main
