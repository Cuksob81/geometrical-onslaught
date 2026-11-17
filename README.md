# Geometrical Onslaught

A fast, top-down survival shooter that runs in the browser. Pick an element, explore an endless cave, fight the swarm,
grow a personal hexagonal upgrade tree, and climb the global ranking. Play alone or in an online co-op party of up to four.

* **Live site:** https://cuksob81.github.io/Geometrical-Onslaught/
* **Stack:** plain HTML, CSS and JavaScript (no build step) + Firebase (Auth + Firestore) + WebRTC for co-op.

---

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page shell. Loads the other two files with a version tag (`?v=16`). **Bump the number when you update** so players do not get cached copies. |
| `styles.css` | All styling. |
| `scripts.js` | The whole game. Your Firebase config is near the end of the file (`FirebaseConfig`). |
| `icon.svg` | Icon (also embedded in the page as the tab icon). |
| `README.md` | This file. |

Upload all of them to the same folder of your repository (GitHub Pages serves it as-is).

---

## How to play

| Action | Keyboard / mouse | Phone |
| --- | --- | --- |
| Move | `WASD` / arrows | left stick |
| Aim | mouse | right stick |
| Fire | hold click or `Space` | hold the right stick (manual aim) |
| Auto-aim | `Q` | button top right |
| Dash | `Shift` | Dash button next to the aim stick |
| Nova (area blast) | `E` | Nova button |
| Upgrade panel (co-op) | `U` | "Upgrade ready" button |
| Pause / settings | `P` | gear button |
| Zoom (view distance) | mouse wheel, or Settings | Settings |

### Modes and difficulty
* **Modes:** Standard (10 rounds), Quickplay (5 rounds), Endless.
* **Difficulties:** Easy, Normal, Hard, Nightmare. They change enemy health, speed, damage, wave size, boss pace and rewards.
* **Mutators:** ten optional handicaps (Glass Cannon, Frenzy, Blood Pact, ...). Each adds +20% to rewards and score.
* **Elements:** Fire, Water, Earth and Wind. Each has its own bolts, a level-3 ability, synergies with the others, and a Nova.
* **Upgrades:** level up to pick one of five cards. Some cards are **Pacts**: a strong bonus with a real cost.

### The infinite cave
The world is generated as you walk and never ends.

* Natural caverns with grass, shallow pools and rock outcrops. Pools slow you (and enemies) down.
* Walls block you, enemies and bolts. Enemies find their way through the caves to you.
* Each run has its own seed. The world stays the same across the rounds of a run.
* **Chests** hide in the caves: healing, XP, a free upgrade, or shards.
* A fog-of-war **minimap** (top right) shows what you have explored.
* Fireflies, glowing fungus and a darkness vignette set the mood. The darkness, fireflies and glow can be reduced with the quality setting.

### The hexagonal upgrade tree
Spend **shards** (earned from runs and chests) in a hexagon map that never ends.

* Open it from the menu (**Upgrade Tree** tab, then *Open upgrade tree*). Drag to pan, scroll or pinch to zoom, tap a hex to select it.
* You start at the **Core**. You can only buy hexes that touch one you already own. Hexes two steps away show as **?**.
* **Every player gets a different tree.** Your tree's seed decides what each hex is. Your six starting hexes are a different
  mix of basic stats for every player, and the tree grows in a different direction as you choose.
* Hex kinds: stat hexes, element **affinities** (extra starting levels when you start as that element), special hexes
  (rerolls, head start, treasure sense, goblin hunter) and small **waystones**.
* Costs rise with distance from the Core and with each level. Returns diminish and every stat has a cap, so the tree is infinite without breaking the game.
* Shift-click (or the *Buy x10* button) buys ten levels.
* Players who had the old Workshop got every shard refunded when the tree replaced it.

### Ranking (solo only)
The ranking measures **how well you played**, not how fast you finished or when you finished. It is per mode (Standard, Quickplay, Endless).

```
base  = kills x 10
      + damage dealt / 20
      + rounds completed x 600
      + objectives completed x 300
      + bosses killed x 1500
      + level x 60
      + chests opened x 120
      + 8000 for winning
      + a "careful" bonus: 4000 - 4 x damage taken (never below 0)

score = base x (1 + 0.2 x mutators) x difficulty reward
        (rewards: Easy 0.5, Normal 1, Hard 1.5, Nightmare 2.5)
```

* **Ties** are broken by the **least damage taken**. This is stored inside the `rank` number
  (`score x 1,000,000 + (999,999 - damage taken)`), so the leaderboard needs no extra index.
* Clear time and date are never used. Two players with identical results share the same place.
* Your best run is kept; a worse run never overwrites it.
* Co-op runs are **not** ranked.

---

## Multiplayer (beta)

Online co-op for 2 to 4 players, one element each. The game shows a warning screen first, because it is not finished.

* **Host a party:** choose name, public or private, 2 to 4 players, mode, difficulty and mutators. A 6-character code is generated.
* **Public parties:** appear in the *Public parties* list while they have room.
* **Join with a code:** for private parties.
* **My parties:** the host's party is saved at the start of every round. Resume it later; original members keep their slot and
  element. If the party had fewer players than its maximum, new players can take empty slots.
* Everyone levels **individually** (own XP, level, upgrades and hex tree). Upgrades never pause the game; a panel opens by
  itself when no enemy is close, or press `U`.
* Co-op rewards are capped at 40 shards per run.

How it works: the host's browser runs the whole game; guests send their input and draw what the host sends (WebRTC data
channels). Firestore carries the lobby and the connection handshake only. Because the host is trusted, co-op is not ranked.

---

## Accounts, saves and privacy

* Sign in with **Google**, **GitHub** or **email and password** (email accounts must verify their email). Signing in creates the account.
* Signed-in players get cloud saves (best times, shards, hex tree, saved parties) and can use the ranking and multiplayer.
* Players can set an **in-game name** (3 to 16 letters, numbers, spaces, `_ . -`). Until then the public name is `Player` plus four characters; real names are never shown.
* **Delete / reset data** (Settings and Account) removes the cloud save and ranking entries and wipes the device.
* Saves are sealed and signed so casual edits are rejected. This is deterrence only; anything running in a browser can be tampered with.

---

## Setting it up (Firebase)

1. **Project:** Firebase console, create a project, add a **Web app**, copy the config into `FirebaseConfig` in `scripts.js`.
2. **Authentication:** enable **Google**. Optional: **GitHub** (needs a GitHub OAuth app) and **Email/Password**. Under
   *Settings*, add your site to **Authorized domains** (for example `cuksob81.github.io`, no `https://`, no path) and consider enabling email enumeration protection.
3. **Firestore:** create a database (Standard edition, `(default)`, production mode) and publish these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn(uid) {
      return request.auth != null && request.auth.uid == uid
        && (request.auth.token.firebase.sign_in_provider != 'password'
            || request.auth.token.email_verified == true);
    }

    match /players/{uid} {
      allow read, delete: if signedIn(uid);
      allow create, update: if signedIn(uid)
        && request.resource.data.Data is string
        && request.resource.data.Data.size() < 200000;
    }

    match /boards/{mode}/entries/{uid} {
      allow read: if true;
      allow delete: if signedIn(uid);
      allow create, update: if signedIn(uid)
        && mode in ['Standard','Quickplay','Endless']
        && request.resource.data.uid == uid
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 4000000
        && request.resource.data.rank is int
        && request.resource.data.rank >= request.resource.data.score * 1000000
        && request.resource.data.rank < (request.resource.data.score + 1) * 1000000
        && request.resource.data.kills is int && request.resource.data.kills <= 40000
        && request.resource.data.round is int && request.resource.data.round <= 60
        && request.resource.data.name is string
        && request.resource.data.name.matches('^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$')
        && (resource == null || !('rank' in resource.data)
            || request.resource.data.rank >= resource.data.rank);
    }

    match /parties/{code} {
      allow get: if request.auth != null;
      allow list: if request.auth != null
        && (resource.data.public == true || resource.data.hostUid == request.auth.uid);
      allow create: if signedIn(request.resource.data.hostUid)
        && code.matches('^[A-Z0-9]{6}$')
        && request.resource.data.name is string && request.resource.data.name.size() <= 24
        && request.resource.data.max in [2, 3, 4];
      allow update, delete: if request.auth != null && resource.data.hostUid == request.auth.uid;
      match /peers/{uid} {
        allow read, create, update, delete: if request.auth != null
          && (request.auth.uid == uid
              || get(/databases/$(db)/documents/parties/$(code)).data.hostUid == request.auth.uid);
      }
    }
  }
}
```

   Old leaderboard entries made before the performance score do not have a `rank` field, so they no longer appear on the
   board. Players' next run creates a fresh entry. You can delete the old documents in the console.

4. **Host it** on https (GitHub Pages is fine) and open the game from that address. Sign-in does not work from `file://`.
5. **Optional, recommended:** restrict the API key to your site (Google Cloud Console, Credentials) and turn on **App Check**
   (paste a reCAPTCHA v3 key into `FirebaseOptions.appCheckSiteKey`; enforce it for Firestore only after confirming sign-in still works).

### Optional: relay (TURN) for strict networks
Some networks block direct peer-to-peer connections. Cloudflare's TURN service has a free monthly allowance. Its credentials
are short-lived and must be created on a server, so deploy a tiny Cloudflare Worker (it calls
`https://rtc.live.cloudflare.com/v1/turn/keys/<KEY_ID>/credentials/generate-ice-servers` with your TURN key) and put its URL in
`FirebaseOptions.turnUrl`. A static list of other TURN servers can go in `FirebaseOptions.turnServers`.
Direct connections still use Cloudflare's free STUN server.

---

## Settings

Audio sliders, graphics quality (low / medium / high), render scale, **view distance (zoom)**, FPS limit and counter,
damage numbers, hit flash, screen shake, reduced motion, colorblind palette, left-handed touch layout, run in background
(the tab keeps playing while hidden, though browsers may slow it), and the delete-my-data panel.

---

## Known limits

* Co-op is a beta: other players are drawn about a tenth of a second behind the host, guests do not see damage numbers, and a party ends if the host leaves (it can be resumed from *My parties*).
* The host is trusted in co-op. The solo ranking is computed on the player's device, so a determined cheater could still submit false results; the rules cap scores and stop them from going down.
* Cloud limits: Firestore's free plan has daily read and write limits. Lobbies write sparingly to stay within them.
* The game has been tested automatically in a headless browser (including real WebRTC between tabs) but not across real home networks or on every phone.

---

## Changelog

### v13 (current)
* **Infinite natural caves** replace the rooms-and-corridors dungeon: chunked generation, grass and pools, rounded rock edges, fog-of-war minimap, fireflies and fungus, enemies that path through the caves, chests.
* **Hexagonal infinite upgrade tree**, unique per player, replaces the linear tree. Old upgrades were refunded.
* **Performance-based ranking** with a damage-taken tie-break replaces the time-based score.
* Multiplayer: every player brings their own hex tree; the world is shared and persists across rounds.
* README added.

### v12
* Multiplayer fixes (immunity after one hit, individual levels, non-blocking upgrades, smoother movement), first procedural dungeon, text-input fix, multiplayer warning screen.

### Earlier
* Online co-op (parties, public list, codes, saved parties), difficulties, create-run screen, mutators, round events, loot goblins, bosses with several abilities, Pacts, Firebase sign-in, cloud saves, in-game names, delete data, ranking, settings.
