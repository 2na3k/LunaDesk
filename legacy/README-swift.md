# LunaDesk

A native macOS SwiftUI recreation of the multi-agent chat interface shown on `x.ai/bot`. The reference page informed the visual language; the running app does not embed a browser or web view.

## Run

```sh
swift run LunaDesk
```

## Build the macOS app bundle

```sh
./scripts/package-app.sh
open dist/LunaDesk.app
```

This creates an ad-hoc signed native app at `dist/LunaDesk.app`. For distribution,
replace the ad-hoc signature with your Developer ID and notarize the bundle.

## Test

```sh
swift test
```

Requires macOS 14 or later and Xcode 16 (or a compatible Swift 6 toolchain).

## Included interactions

- Select and search teammates.
- Open a fresh agent thread with **Command–N** or the plus button.
- Send a message with Return or the send button.
- Toggle the microphone recording state when the composer is empty.
- Resize the native split view and window.
