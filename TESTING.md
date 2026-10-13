# B.O.S.S. — Tester Guide

Thanks for trying BOSS. This takes about **30–35 minutes**. You don't need to be technical — just do the steps, write down what happened, and send us the report at the end.

**What BOSS is:** an assistant you talk to in your own words. You type (or speak) a request; it finds the right part of itself to handle it — timers, notes, music, calls, files, weather and more. It works offline and keeps your data on your device.

**Your goal isn't to make everything pass.** If something is confusing, wrong or missing, that's exactly what we need to hear.

---

## 0 · Before you start

1. Open the BOSS link on the device you want to test (phone or computer).
2. **Install it** if you can:
   - **iPhone (Safari):** Share button → *Add to Home Screen*.
   - **Android (Chrome):** ⋮ menu → *Install app* (or *Add to Home screen*).
   - **Computer:** just use the browser tab.
3. Open BOSS from the new icon. Write down your **device and browser** (e.g. "iPhone 14, iOS 18, Safari" or "Pixel 8, Android 15, Chrome").
4. If you've used an older version of BOSS before: **Settings (⚙) → Update BOSS** once.

> **How to read the steps:** *Say / do* is what you type into the box at the bottom (or tap). *Expect* is what should happen. If it doesn't, mark it ✗ and note what you saw.

---

## 1 · First run & home screen

| # | Say / do | Expect |
|---|---|---|
| A1 | Open BOSS for the first time (or Settings → **Quick intro**). | A 3-card intro. **Skip**, **Back** and **Next** work; the last card says **Start** and takes you to the Home screen. |
| A2 | On Home, tap **“Set a 10 minute timer”**. | You land on the field and a 10-minute timer is set (see the log at the bottom). |
| A3 | Tap **🏠** at the top, then untick **“Show this screen when BOSS opens”**. Close and reopen BOSS. | It opens straight to the field. 🏠 brings Home back. (Re-tick it afterwards if you like Home.) |
| A4 | On Home tap **❓ What can BOSS do?** and tap any example. | The list is readable; tapping an example runs it. |

## 2 · Everyday requests

Type each one and press **PULSE ⚡** (or Enter). Give BOSS a few seconds between requests.

| # | Say / do | Expect |
|---|---|---|
| B1 | `set a timer for 1 minute` | Timer set. When it ends you get an alert/sound **while BOSS is open**. |
| B2 | `alarm at` *(a time 2–3 minutes from now)* | Alarm set. It rings **only while BOSS is open** (known limit — see §6). |
| B3 | `what time is it in Tokyo` | Shows the time in Tokyo. |
| B4 | `what's the weather` | Asks for location permission (allow it), then shows a forecast. Needs internet. |
| B5 | `where am i` | Asks for location permission if not already given, then shows where you are. |
| B6 | `remember my locker code is 4821` → `what do you remember` → `show my notes` | Stored → listed → the Notes panel opens. |
| B7 | `play music` → `volume down` → `stop` | A simple tone/player starts; volume drops; it stops. |
| B8 | `open text tools` | The Text Tools panel opens. *(Running a summary needs an AI key — skip if you have none.)* |
| B9 | `list apps`, then `open Spotify` (or another app you have) | Lists apps; then shows a **“Tap to open”** button that opens the app. |
| B10 | `make a phone call` | A Phone panel opens. Type a number you own and tap **Call** → your dialler opens (you press call). |
| B11 | `text` *(your own number)* `saying hi` | Your Messages app opens with the text ready; **you** press send. |
| B12 | `battery` | BOSS answers in the log. (Some iPhone browsers can’t read the battery — a polite “can’t read it” is fine.) |
| B13 | `change theme to amber`, then `reset theme` | Colours change, then return to default. |
| B14 | `voice on`, then `what time is it in London` | BOSS speaks the answer aloud. (If you use Bluetooth headphones, note **where** the voice comes out — phone speaker or headphones.) |
| B15 | Tap **🎤**, say “set a timer for two minutes” | It listens, writes what it heard, and sets the timer. Allow the microphone if asked. |
| B16 | `flashlight` | An honest message: this needs the BOSS native app. |
| B17 | `what can you do` | The “What can BOSS do?” screen opens. |

## 3 · Say it your own way

BOSS should understand ordinary wording. Try a few of your **own** versions of the requests above — e.g. “can you remind me in ten minutes”, “how hot is it outside”, “I want to call my mum”, “wake me up at 7”. Note any that don't do what you'd expect.

| # | Do | Expect |
|---|---|---|
| C1 | Make up **5 requests** in your own words (anything you'd really ask a phone assistant). | Most should work. For each one that doesn't, use the flag in D1 below. |
| C2 | `tell me a joke` | If no AI key is set: a clear message that open questions need one. With a key: an answer. |
| C3 | Do two different things back-to-back (e.g. `play music`, then immediately `set a timer for 5 minutes`). | Each goes to the right place. If the second one goes somewhere odd right after the first, **flag it** — see the note below. |

> **Note:** BOSS briefly “remembers” what you just used, which can occasionally pull the next request to the same part. We know this exists and want examples — flagging them helps a lot.

## 3b · Talking to BOSS

BOSS now handles everyday small talk and follow-ups. Try these in order (give each a moment):

| # | Say / do | Expect |
|---|---|---|
| G1 | `hi` → `how are you` → `thanks` → `bye` | Short, natural replies. Not repeated word for word if you do it twice. |
| G2 | `thanks, set a timer for 1 minute` | The timer is set **and** BOSS says you're welcome. (The request must never be lost.) |
| G3 | `set a timer` → then just `10 minutes` | BOSS asks how long, then sets a 10-minute timer. |
| G4 | `what time is it in Tokyo` → `and in London` | The second answers for London. Also try `what's the weather in Paris` → `and in Rome`. |
| G5 | `set a timer for 5 minutes` → `make it 10`, then `cancel that` | A 10-minute timer is set; then timers are cancelled. |
| G6 | `tell me a joke` → `another one` | A joke, then a different one. |
| G7 | `i'm tired`, `i'm bored` | A friendly reply with small tappable suggestions — tap one and it runs. |
| G8 | Settings → **Personality**: switch to *Dry*, *Playful*, *Formal*, *Concise* and say `hello` and `thanks` each time. | The replies change tone. |
| G9 | Say something chatty that BOSS can't know, e.g. `what do you think about cats`. | No engine: a clear message that open chat needs an AI engine. With an engine key: a short answer in the chosen tone. |
| G10 | Try 3–5 ordinary chit-chat lines of your own. | Anything that gets a strange reply or triggers the wrong feature: tap ✋ **Not what I meant**. |

*(Please don't test the distress response with real feelings. If you want to check it exists, a tester can ask the dev team.)*

## 4 · Reporting problems (please do this as you go)

| # | Do | Expect |
|---|---|---|
| D1 | After any request that went wrong, tap **✋ Not what I meant** (it appears above the input box for ~30 seconds). Pick the part that *should* have handled it (or “None”) and add a note. | “Thanks — saved.” |
| D2 | If BOSS asks **“which did you mean?”** pick the right answer. | It runs your choice. After a few repeats of the same choice it should stop asking (see Settings → **Learning**). |
| D3 | At the end: **⚙ Settings → 💬 Send feedback**. Add your name/initials and a note, tap **👁 Preview file**, then **📤 Share** or **⬇ Save file** and send the file to us. | You can see exactly what’s in the file. Numbers, emails and links are hidden by default. |

## 5 · Settings, data & updates

| # | Do | Expect |
|---|---|---|
| E1 | Settings → **Text size XL**. Look at the top bar, the input box and a couple of panels. | Nothing is cut off or overlapping. Set it back to **M** afterwards. |
| E2 | Settings → **Permissions**. | Shows location / microphone / camera / notifications state. |
| E3 | Settings → **Backup** → export. | A backup file is created. *(Optional, destructive: Settings → Erase everything → then Backup → import to restore. Only do this if you exported first.)* |
| E4 | Settings → **Update BOSS**. | The app reloads and still works. |
| E5 | Turn the device to **airplane mode**, then reopen BOSS. | It still opens. Timers, notes and the clock work; weather says it needs a connection. |
| E6 | Settings → **Learning**. | Shows how many “which did you mean?” answers you’ve given and any learned choices. You can switch it off or reset it. |

---

## 6 · Known limits (no need to report these)

- **Alarms and timers only ring while BOSS is open.** Real background alarms need the native app.
- **No contacts access** — “call mum” can’t look anyone up; use a number.
- **Can’t switch Bluetooth, Wi-Fi, airplane mode, flashlight** or record the screen — needs the native app.
- **Calls/texts/emails** open your own apps; **you** press send/call.
- **Open questions, “Look” (photos) and Text Tools summaries** need an AI engine key (Settings → Engine keys).
- **iPhone + Bluetooth headphones:** after dictating, BOSS’s voice may play from the phone speaker instead of the headphones. We’re working on it — tell us what you see.
- **Computer browsers** may not open phone-style links (call/text).
- **iPhone Shortcuts** (“run shortcut …”) only work on iPhone.

---

## 7 · Your results

Copy this table into a note or email (or just attach the report file from D3 — it already contains the details).

**Device / browser:** ________________  **Installed to home screen?** Yes / No  **BOSS version** (Settings → About): ________

| Step | ✓ / ✗ / partly | What happened (one line) |
|---|---|---|
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |
| B5 | | |
| B6 | | |
| B7 | | |
| B8 | | |
| B9 | | |
| B10 | | |
| B11 | | |
| B12 | | |
| B13 | | |
| B14 | | |
| B15 | | |
| B16 | | |
| B17 | | |
| C1 (your 5 requests) | | |
| C2 | | |
| C3 | | |
| G1 | | |
| G2 | | |
| G3 | | |
| G4 | | |
| G5 | | |
| G6 | | |
| G7 | | |
| G8 | | |
| G9 | | |
| G10 | | |
| D1 | | |
| D2 | | |
| D3 | | |
| E1 | | |
| E2 | | |
| E3 | | |
| E4 | | |
| E5 | | |
| E6 | | |

**What confused you most?**

**What did you expect BOSS to do that it didn't?**

**Anything you'd tell a friend about it (good or bad)?**
