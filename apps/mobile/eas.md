  distribution: internal = ad-hoc build, installable on your registered devices without TestFlight.

  5. Build

  eas build --platform ios --profile preview
  First run asks to log in with your Apple ID and auto-generates certs/provisioning profile. Build runs on EAS servers (~10–20 min).

  6. Install on your iPhone

  When the build finishes, EAS prints a URL + QR code. Open it on the iPhone in Safari → tap Install. The app appears on your home screen.

  Iterating after that

  - JS/asset changes only: eas update --branch preview — pushes over-the-air, app picks it up on next launch. No rebuild.
  - Native changes (new native module, plist, permissions): rerun eas build --platform ios --profile preview.
  - Adding more test devices: eas device:create again, then rebuild.

  When you're ready for TestFlight

  eas build --platform ios --profile production
  eas submit --platform ios --latest