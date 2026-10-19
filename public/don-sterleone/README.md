# Don Sterleone

A neon-noir 3D driving game that runs in the browser. Take jobs from the crew, race the clock between pickups and drops, and shake the cops before they shake you down. The soundtrack is "Don Sterleone" by s73rl.

**Play:** https://claude.ai/artifact/NNMzsEZDASnW2eMW53HJ8d, or at `/don-sterleone/` on the Musaix site (served as-is from `public/don-sterleone/`).

---

## How to play

1. **Pick a driver** on the menu.
2. **Start the night.** You spawn at the Hideout and the radio starts.
3. **Pick up:** Drive into the **cyan** beam before the timer runs out.
4. **Drop off:** Get the package to the **pink** beam. Once you have the package, police cars give chase.
5. **Get paid:** Each delivery pays a base reward plus a bonus for the time left on the clock.

If the timer runs out, the job fails and a new one comes in. Each time a cop rams you, you lose cash, so keep moving.

### Drivers

| Driver        | Car                                    | Feel                     |
| ------------- | -------------------------------------- | ------------------------ |
| **The Don**   | Red '86 Testa wedge supercar           | Fast, planted, high grip |
| **Cold Case** | Black '70 muscle car with gold stripes | More torque, looser tail |

### Heat

The number of cops chasing you on a drop goes up as you complete more jobs:

| Jobs completed | Cops on the drop |
| -------------- | ---------------- |
| 0–2            | 1                |
| 3–5            | 2                |
| 6+             | 3                |

Each cop can ram you once every 3 seconds. Each hit costs $1,500 plus $500 per heat star.

## Controls

| Action                                | Keyboard                   | Touch                |
| ------------------------------------- | -------------------------- | -------------------- |
| Gas                                   | `W` / `↑`                  | Gas                  |
| Brake / reverse                       | `S` / `↓`                  | Brk                  |
| Steer                                 | `A` `D` / `←` `→`          | ◀ ▶                  |
| Handbrake drift                       | `Space`                    | Drift                |
| Nitro                                 | `Shift` (while on the gas) | NOS                  |
| Switch camera (chase / high / bumper) | `C`                        | none                 |
| Radio on/off                          | `M`                        | Tap the radio button |
| Pause                                 | `P` / `Esc`                | none                 |

The game also pauses on its own when you switch to another tab.

## The city: Vista Hermosa

- An 8×8 grid of blocks with downtown towers, rooftop neon signs, and blinking aircraft lights.
- **Ocean Drive** on the east edge: pastel art deco hotels with neon trim, then a palm-lined beach and the ocean.
- Three parks with fountains, plus the **Hideout** (marked **H** on the minimap).
- Wet, reflective streets, traffic, tyre smoke, and a rotating minimap that faces the way you're driving.

## Saving

Your cash and number of completed jobs are saved in `localStorage` under the key `donSterleone`. Saves stay in that one browser on that one device and aren't shared. Clearing your site data resets them.

## Tech

- One `index.html` with no build step. [three.js](https://threejs.org) 0.160 is loaded from jsDelivr through an import map.
- Rendering uses ACES tone mapping, an Unreal bloom pass, and a generated environment map for reflections.
- Building windows, neon signs, road markings, and puddles are drawn on canvases in code, not loaded as image files.
- Engine and siren sounds are synthesized live with the Web Audio API.
- Driving is custom arcade physics: forward and sideways grip, handbrake slide, and box collisions with the buildings.

### Files

| File                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `index.html`          | The whole game: markup, styles, and code |
| `keyart.jpg`          | Menu key art                             |
| `don.jpg`, `cold.jpg` | Driver portraits                         |
| `track.mp3`           | Radio track, "Don Sterleone" by s73rl    |

### Run locally

Serve the folder over HTTP, because ES modules don't load from `file://`:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the address it prints. The game needs an internet connection to load three.js and the Google Fonts.

## Known issues

- The police siren keeps playing while the game is paused.
- Neon signs can sometimes fall back to a plain font if the Saira font hasn't loaded when the city is built.
- On touch devices the job panel (title, timer, distance) is hidden, and there are no pause or camera buttons.
- The timer and distance keep showing the last job's values until the next job starts.

## Credits

Game design and art direction: Don Sterleone / s73rl. Music: "Don Sterleone" by s73rl.
