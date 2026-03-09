# HandeePOS – Android deployment (APK & Play Store with EAS)

This guide covers building an APK and publishing the app to Google Play using **EAS (Expo Application Services)**.

---

## Prerequisites

- **Node.js** and **npm** (or yarn) installed
- **Android adaptive icon:** `assets/images/android-icon-foreground.png` must be **square** (e.g. 1024×1024). If `npx expo doctor` reports non-square dimensions, replace the file with a square PNG so the build and store listing validate.
- **Expo account** – [create one](https://expo.dev/signup) if needed
- **EAS CLI** – install globally:
  ```bash
  npm install -g eas-cli
  ```
- **Google Play Console** account (for Play Store deployment)

---

## Part 1: Building an APK

APKs are useful for local testing, internal distribution, or sideloading. EAS can build them in the cloud without Android Studio.

### 1.1 Log in to Expo

From the **mobile** project root (where `app.json` lives):

```bash
cd mobile
eas login
```

Use your Expo credentials.

### 1.2 Configure EAS (first time only)

If the project does not yet have EAS config:

```bash
eas build:configure
```

This creates `eas.json` with build profiles. You can edit profiles later (e.g. add an `apk` profile).

### 1.3 Ensure an APK build profile

Open `eas.json`. You want a profile that produces an **APK** (not AAB). For example:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

- **`preview`** with `"buildType": "apk"` → builds an APK (good for testing).
- **`production`** with `"buildType": "app-bundle"` → builds an AAB for Play Store (see Part 2).

If you don’t have a profile that outputs APK, add one (e.g. copy `preview` above).

### 1.4 Build the APK

From the **mobile** directory:

```bash
eas build --platform android --profile preview
```

(Use the profile name you set with `"buildType": "apk"`.)

- EAS will prompt for any missing configuration (e.g. Android package name).
- Build runs in the cloud. When it finishes, you get a link to download the **APK**.

### 1.5 Download and install the APK

1. Open the build link from the terminal or from [expo.dev](https://expo.dev) → your project → **Builds**.
2. Download the APK to your machine or device.
3. On a device: enable **Install from unknown sources** for the browser or file manager, then open the APK and install.

You can now share this APK for internal testing or sideloading.

---

## Part 2: Deploying to the Google Play Store with EAS

For Play Store you must submit an **Android App Bundle (AAB)**, not an APK. EAS can build the AAB and (with EAS Submit) upload it to Play Console.

### 2.1 Play Console setup

1. Go to [Google Play Console](https://play.google.com/console).
2. Create an app (or select HandeePOS) and complete the required setup:
   - App access, ads declaration (if applicable), content rating, target audience, etc.
3. Note:
   - **Package name** – must match `app.json` → `expo.android.package` (e.g. `com.anonymous.handeepos`). If you change it, use a unique package name and update `app.json`.
   - **Service account** (needed for EAS Submit):
     - Play Console → **Setup** → **API access** → link or create a Google Cloud project.
     - Create a **service account** in Google Cloud with **JSON key**.
     - In Play Console → **Users and permissions** → invite the service account and grant at least **Release to production, exclude devices, and use Play App Signing** (or equivalent) for the app.

### 2.2 Production AAB profile in EAS

In `eas.json`, ensure a production profile builds an AAB:

```json
"production": {
  "android": {
    "buildType": "app-bundle"
  }
}
```

### 2.3 Build the AAB

From the **mobile** directory:

```bash
eas build --platform android --profile production
```

Wait for the build to finish. The output will include a link to the **AAB** artifact.

### 2.4 Configure EAS Submit for Play Store

Link your Expo project to the Play Store app and credentials:

```bash
eas submit:configure
```

- Choose **Android** and **Google Play Store**.
- EAS will prompt for:
  - **Service account JSON key** – path to the key file you created in Play Console / Google Cloud.
  - **Package name** – must match your app in Play Console and `app.json`.

Credentials are stored in EAS and reused for future submits.

### 2.5 Submit the latest build to Play Store

**Option A – Submit the most recent production build:**

```bash
eas submit --platform android --profile production --latest
```

**Option B – Submit a specific build by ID:**

```bash
eas submit --platform android --profile production --id <BUILD_ID>
```

(`BUILD_ID` is in the build URL or in the Expo dashboard.)

- Choose the **track**: internal testing, closed testing, open testing, or production.
- EAS uploads the AAB and creates a new release on that track.

### 2.6 Complete the release in Play Console

1. In Play Console, open your app → **Release** → the track you used.
2. Edit the new release: add **Release name** and **Release notes** (and any other required fields).
3. Review and **Start rollout** (or **Review release** then rollout).

---

## Summary

| Goal              | Command / step |
|-------------------|----------------|
| Build APK         | `eas build --platform android --profile preview` (with `buildType: "apk"` in `eas.json`) |
| Build AAB for Play| `eas build --platform android --profile production` (with `buildType: "app-bundle"`) |
| Submit to Play    | `eas submit --platform android --profile production --latest` (after `eas submit:configure`) |

---

## References

- [EAS Build – Get started](https://docs.expo.dev/build/introduction/)
- [EAS Build – Android app credentials](https://docs.expo.dev/build-reference/android-credentials/)
- [EAS Submit – Android](https://docs.expo.dev/submit/android/)
- [Google Play Console](https://play.google.com/console)
