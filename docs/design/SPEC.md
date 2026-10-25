# DocWatch MVP UI spec

Source of truth for the UI. Mockups in this folder are the minimum to implement. Match layout, hierarchy and copy; exact pixels are not required.

## Design system
- iOS grouped style: background #F2F2F7, white rounded cards (12pt radius), system font (SF Pro).
- Accent blue #1A5CFF for primary buttons, links, active tab, selected chips.
- Status colors: Expired red #FF3B30, within 30 days orange #FF9500, within 90 days blue #1A5CFF, all good green #34C759, no date gray #8E8E93.
- Category icons: colored rounded-square tile with a white SF-style glyph (Passport purple, Insurance green, Lease orange, Vehicle teal, Health pink, Driver's License blue, Other gray). Use @expo/vector-icons (Ionicons).
- Large titles on tab roots, light/dark not required for MVP (light only).

## Navigation (bottom tab bar)
Upcoming | Documents | Shared | Settings. Document detail, viewer, share sheet and onboarding are stacks/modals over the tabs.

## Screens

### 01 Onboarding / Sign in (01-onboarding-signin.png)
App icon, "DocWatch", tagline "Keep every important document current, with a reminder before anything expires."
Three value rows: Scan or import / Dates found for you / Reminded in time (30 days ahead by default, or on a date you choose).
Buttons: Sign in with Apple (black), Continue with Google (outlined), Continue with Email (text link -> email/password screen).
Footer: "By continuing you agree to the Terms and Privacy Policy." No carousel.

### 02 Notification priming (02-notification-priming.png)
Shown once after first sign-in. "STEP 2 OF 2", "Turn on notifications", explainer, sample notification card, "Allow Notifications" (triggers the system prompt), "Not Now". Choice saved; can be changed in Settings.

### 07 Upcoming tab (07-upcoming.png) - home
Date eyebrow (e.g. FRIDAY, OCTOBER 16), large title "Upcoming", blue camera button top right (opens Take Photo / Choose Photo / Choose File).
Four tiles with counts: Expired, Within 30 days, Within 90 days, All good. Tapping a tile filters the list below (selected tile filled with its status color). Default selection: the most urgent non-empty tile.
List rows: category icon, title, colored status line ("Expires in 14 days", "Expired 6 days ago"), short date on right, chevron.

### 06 Documents tab (06-documents.png)
Large title "Documents", blue + button. Search bar (title, issuer). Category filter chips (All + categories present). List grouped by category with section headers. Row: category icon, title, status line ("Valid until Mar 2, 2029" in green when > 90 days), shared icon if shared, date, chevron. Failed/processing docs appear here with a Try again / spinner state.

### 03 Document detail (03-document-detail.png)
Back, Share icon (opens sharing sheet). Preview card labeled "Original scan" (tap = full-screen viewer; PDFs render first page). Title, subtitle (issuer - masked document number), status pill.
DETAILS card: Category (editable picker), Holder, Expires (native date picker), Renewal (native date picker, optional), Added.
REMINDER card: "Default - 30 days before" with computed date/time and sent state; "Set Custom Reminder" (date + time picker; clearable).
Keep Delete at the bottom (red, with confirmation).

### 04 Settings (04-settings.png)
Profile card (initials avatar, name, sign-in method, email).
REMINDERS: Default Reminder (7/14/30/60/90 days before), Reminder Time (time picker, default 09:00), Notifications toggle. Footer: "Applies to every document without a custom reminder."
PRIVACY & SECURITY: Require Face ID toggle (expo-local-authentication, lock on launch and after 1 min in background), Export My Data (zip of files + JSON, via share sheet), Delete Account (confirm, deletes Auth user, Firestore and Storage data via callable function).
Sign Out.
Plan card ("Free plan, 5 of 10 documents, Upgrade"): see open decision below.

### 05 Sharing (05-sharing.png)
Share sheet from document detail: "Share \"<title>\"", email field, View only explainer, Send Invite, PEOPLE WITH ACCESS list with Revoke (confirm).
Shared tab: segmented "Shared with Me" / "Shared by Me". Rows show title (owner first name), "From <name> - View only", date. Footer explainer. Received docs open read-only (no edit, reshare, delete, reminders).

## Decisions (Adam, Oct 24 2026)
- Plan card / Upgrade / document limit: OUT of MVP. Do not build or show it in Settings.
- Sharing invite emails: sent via Resend from the docwatch.ai domain, integrated LAST after all other features are tested. Until then, invites work in-app only (invitee sees the doc in Shared once signed in with the invited email); no email is sent.
