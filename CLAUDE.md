# Polaris Cooktop Precision Cooking Prototype

Plain HTML/CSS/JS prototype (`index.html`, `app.js`, `styles.css`) for iPad user testing.
See `README.md` and `docs/master_reference.md` for screen/flow details; `GEMINI.md` holds the
Antigravity agent's notes for the same project.

## Every change must reach all three links

The user expects each requested change to show up on all of these right away (or after a refresh):

| Link | Served from |
|---|---|
| Local: `http://localhost:8080/?task=3#task3` | `python3 scripts/serve.py` (no-cache server, port 8080) running in **this folder** |
| iPad: `http://<Wi-Fi IP>:8080/?task=3#task3` | same local server over Wi-Fi (IP: `ipconfig getifaddr en0`) |
| Live: https://shulankuang.github.io/polaris-cooktop-precision-cooking/ | GitHub Pages, built from `main` `/` |

After making and verifying a change, always finish with:

```bash
scripts/publish.sh "fix: <what changed>"
```

It bumps the `?v=` cache tags on `styles.css` and `app.js` in `index.html` (so iPad Safari and the
home-screen app fetch fresh files), makes sure the local server is up, commits and pushes to
`main`, then waits until GitHub Pages serves the new version. Report the result to the user.

Notes:
- Work in this folder (`~/Documents/PolarisPrototypeCooktopPrecisionCooking`): it is the one the
  local server and the localtunnel serve. Run `git pull --ff-only` first if Antigravity may have pushed.
- Commit straight to `main` (that is what Pages publishes); `gh` is at `~/bin/gh`.
- If a changed image/asset keeps the same filename, iPad may cache it: rename it or add `?v=` to its URL.
- Verify UI changes in a browser before publishing. Test helpers exposed on `window`:
  `setKnobAngle`, `showT3Screen`, `startGuidedCooking`, `setGuidedStep`, `t3BurnerTargetTemps`,
  `currentT3BurnerLevels`, `els`.
