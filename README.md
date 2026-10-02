# ato

An Aeon Trespass: Odyssey Argonaut dashboard built with Expo and TypeScript for
web, iOS and Android. It contains a bundled catalogue and independent player
state for four Argonauts. Select **Browse Gear** on the dashboard to search cards,
inspect abilities and flip reversible Gear. Secret cards start hidden.
[Stage 3 status and verification](docs/STAGE_3_GEAR.md) records the rendering
rules, completed checks and remaining native runtime review. The earlier
[dashboard notes](docs/STAGE_2_DASHBOARD.md) cover Argonaut controls and layout.

## Start

From this directory:

```sh
npm install
npm start
```

In the Expo terminal, press `i` for the iOS Simulator or `a` for an Android
emulator. You can also scan the QR code with Expo Go on a physical device.
Keep your phone and computer on the same network.

### iOS Simulator

Install full Xcode, open it once to complete setup, and install an iOS Simulator
runtime in Xcode Settings. Select Xcode as the active developer tools if needed:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
npm run ios
```

### Android emulator

Install Android Studio and its Android SDK. Create and start a virtual device
using Device Manager. On macOS with the default SDK location, configure:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
npm run android
```

### Browser

```sh
npm run web
```

## Edit and check

Routes live in `src/app/`; the dashboard lives in `src/dashboard/`. The shared
party reducer and context are in `src/state/`. Edit and save to test Fast Refresh.
The original tap-test screen remains in `App.tsx` and is no longer the entry point.

```sh
npm run typecheck
npm run lint
npm run test:domain
npm run catalogue:check
```

For native tooling later, `npx expo run:ios` or `npx expo run:android` generates
the native project and builds a local app; this requires the platform toolchain.
The starter can run in Expo Go without generating native projects.

See [Expo's development guide](https://docs.expo.dev/get-started/start-developing/).
