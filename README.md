# docwatch

Snap or upload a document. docwatch reads it, finds the expiration date, and reminds you before it expires. No forms, no categories, no settings.

## Stack

| Layer | Choice |
|---|---|
| App | Expo (React Native, iOS), TypeScript |
| Auth | Firebase Auth: Sign in with Apple, Google, Email |
| Storage / DB | Cloud Storage for Firebase, Firestore |
| AI | Gemini 2.5 Flash via Vertex AI (image + PDF in, structured JSON out) |
| Backend | Cloud Functions for Firebase (2nd gen): Storage trigger + hourly scheduler |
| Push | expo-notifications + Expo push service (APNs under the hood) |

## User flow (the whole app)

1. Sign in (Apple / Google / Email - email auto-creates the account, no separate sign-up).
2. Tap **+ Add document** -> Take Photo / Choose Photo / Choose File (PDF or image).
3. Done. The list shows "Reading..." then the title and "Expires in N days".
4. Push notifications at 30, 7, 1, 0 days before expiry, 9am local time.
5. If AI confidence < 0.6 or no date found, the user gets a "Quick check?" push. Tapping it opens a one-tap confirm screen. Ignoring it is fine; reminders still fire on whatever was extracted.

## Defaults baked in (no user settings)

| Default | Value | Where |
|---|---|---|
| Review threshold | confidence < 0.6 | `functions/src/index.ts` |
| Reminder schedule | 30, 7, 1, 0 days before | `functions/src/index.ts` |
| Send time | 9am user's local tz (captured at sign-in) | `functions/src/index.ts` |
| Model | `gemini-2.5-flash` (env `VISION_MODEL`) | `functions/src/extract.ts` |
| Max upload | 20 MB, image/* or PDF | `storage.rules` |

## Data model

```
users/{uid}                { pushToken, timezone, email }
users/{uid}/docs/{docId}   { status, title, docType, issuer, expirationDate, renewalDate,
                             confidence, needsReview, remindersSent[], storagePath, contentType, createdAt }
gs://.../users/{uid}/docs/{docId}/original.{jpg|pdf}
```

Status: `processing` -> `ready` | `no_date` | `failed`. Client can only create `processing` records and edit date/title/review fields; everything else is server-written (see `firestore.rules`).

## Setup

### 1. Firebase / GCP
```bash
npm i -g firebase-tools eas-cli
firebase login
# Create a project in console.firebase.google.com (Blaze plan - Functions + Vertex need it)
sed -i 's/YOUR_FIREBASE_PROJECT_ID/<project-id>/' .firebaserc
gcloud services enable aiplatform.googleapis.com --project <project-id>
```
In the Firebase console:
- Authentication -> enable **Apple**, **Google**, **Email/Password**.
- Build an iOS app, download `GoogleService-Info.plist` into `app/`.
- Project settings -> copy the web config into `app/app.json` -> `extra.firebase`.
- Google sign-in: copy the Web client ID and iOS client ID into `app/app.json` (`extra.googleWebClientId`, `extra.googleIosClientId`, and the `iosUrlScheme` plugin value).

Grant the Functions service account Vertex access:
```bash
gcloud projects add-iam-policy-binding <project-id> \
  --member serviceAccount:<project-number>-compute@developer.gserviceaccount.com \
  --role roles/aiplatform.user
```

### 2. Deploy backend
```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only firestore,storage,functions
```

### 3. App
```bash
cd app && npm install
eas init                      # fills extra.eas.projectId
eas credentials               # upload APNs key for push
npx expo prebuild -p ios
npx expo run:ios --device     # Apple Sign In + camera need a real device
```
Sign in with Apple requires the capability on your App ID in the Apple Developer portal (prebuild adds the entitlement).

## Swapping Expo push for raw FCM
`functions/src/push.ts` is the only file that sends. Replace `expo-server-sdk` with `getMessaging().send()` and store an FCM token from `@react-native-firebase/messaging` in `users/{uid}.pushToken`.

## Not included (by design)
Android, categories/folders, manual entry as a first-class flow, sharing, OCR text search, reminder customization. All of these add user effort; the product promise is "upload and forget".
