# 🚛 Pour Decisions — A Concrete Business Story

A story-driven concrete contracting sim. Start with your grandpa's finishing
tools and $5,000, and build a flatwork empire one perfect broom finish at a
time — while Big Mike's Discount Concrete races to the bottom across town.

Every phase of a real flatwork job is in the game:

| Phase | What you do |
|---|---|
| ☎️ **Bids** | Walk jobs, measure them, price them against the market (and Big Mike) |
| 🛠️ **Equipment** | Buy iron — plate compactor, laser, power screed, early-entry saw, power trowel, skid steer + breaker — each changes how phases play |
| 🔨 **Demo** | Bust out old driveways, sidewalks, and garage floors |
| 📐 **Forms & flow lines** | Set stake elevations to 1/8″ for proper fall — no bird baths |
| 📠 **Order the mud** | Spec the mix like a pro: *"7 bag, low chert, air, microfiber, 1% NCA, 4″ slump"* — match bags, air %, fiber, accelerator, and slump to the weather and the job |
| 🚛 **Pour** | Place and screed against the truck clock; demurrage isn't a charity |
| ✂️ **Control joints** | Tool or saw-cut joints — 2.5× thickness rule, panels near square |
| 🪄 **Finish** | Bull float, respect the bleed water, edge, broom or power-trowel in the timing windows |

And it plays out in a **living, procedurally-drawn world** (all canvas, no
image assets):

- 🗺️ **Town map** — Cedar Falls, drawn house by house: your shop, City Hall,
  seasonal trees, falling leaves or snow by chapter. Job leads appear as
  bouncing `$` markers on real houses; the story job is the `★`. Win a bid and
  your truck drives across town to the site.
- 🏘️ **Animated job sites** — every phase happens on the customer's actual
  lot: the slab cracks apart chunk by chunk during demo, the mixer's drum
  spins while the chute pours mud where you click, your crew screeds along
  the pour front, bleed water sheens across the setting slab, and broom
  lines / trowel swirls / joint cuts appear as you finish. The customer
  watches from the porch.
- 👷 **Crew (Sims-style)** — applicants call when word gets around. Hire up
  to 3, each with a name, portrait, bio, wage, and a trait that changes how
  phases play (Fast Hands doubles demo damage, Screed Wizard places +1
  section, Old Pro widens finishing windows, Steady Eye reads string lines).
  They appear on-site, working. Wages come out of every job.
- 📆 **Overhead** — every day costs money (truck payment, insurance, coffee).
  Idle time hurts.
- 🐕 **Site events** — sometimes a dog charges the wet slab. SHOO it in time
  or live with pawprints in your finish forever.

Five story chapters (sidewalk → driveways → cold-weather pour → garage floor →
the City Hall plaza showdown), reputation, a Crete-o-pedia of real concrete
knowledge, and cause-and-effect failures: skip air entrainment outside and the
slab scales after winter; hard-trowel a 6%-air mix and it delaminates. Dale
told you. He TOLD you.

## 📸 Screenshots

| | |
|---|---|
| ![Town](docs/screens/02-town.png) | ![Demo](docs/screens/06-demo.png) |
| ![Pour](docs/screens/09-pour.png) | ![Finishing + dog](docs/screens/10-finish-dog.png) |
| ![Crew](docs/screens/03-crew.png) | ![Results](docs/screens/12-results.png) |

More in [`docs/screens/`](docs/screens/) — regenerate with
`node test/screenshots.mjs` (needs `webkit2gtk-driver` + `xvfb`, see the
script header).

## ▶️ Play (web)

It's a zero-dependency static site:

```sh
npx http-server -p 8080 .
# or: python3 -m http.server 8080
```

Open http://localhost:8080. Progress autosaves to localStorage.

It is also a full **PWA** — host it anywhere (GitHub Pages works) and it's
installable from Safari/Chrome with offline play.

## 📱 iOS

Two options:

**1. Install as a web app (no Mac needed)** — host the site over HTTPS, open
it in Safari on iPhone/iPad, then *Share → Add to Home Screen*. Full-screen,
offline-capable, app icon included.

**2. Native app via Capacitor (App Store-ready)** — a generated Xcode project
lives in `ios/`. On a Mac with Xcode + CocoaPods:

```sh
npm install
npm run ios:sync   # stage web assets into www/ and sync the native project
npm run ios:open   # open in Xcode → set your signing team → Run
```

App ID: `com.pourdecisions.game`. Icons and splash screens are already wired
into the asset catalog. Regenerate icons anytime with
`python3 scripts/gen_icons.py`.

## 🧪 Tests

```sh
npm install
node test/smoke.mjs
```

Plays Chapter 1 end-to-end in jsdom — title screen through bid, demo, forms,
mix order, pour, joints, finishing, and the results screen.

## 🗂️ Layout

```
index.html            game shell (PWA meta, script loading)
css/style.css         all styling
js/data.js            equipment, mix pricing, story chapters, Crete-o-pedia
js/minigames.js       demo / forms / pour / joints / finishing minigames
js/game.js            state, hub, bidding, ordering, scoring, story flow
icons/                generated PNG icons (scripts/gen_icons.py)
ios/                  Capacitor Xcode project
scripts/build-www.mjs stages web assets into www/ for Capacitor
test/smoke.mjs        end-to-end smoke test (jsdom)
```
