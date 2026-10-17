# Orgo Jeopardy

Three pages, all served by `server.js` (no dependencies):

| Page | Who | What it does |
|---|---|---|
| `/` | Main screen (laptop/projector) | Board, clues, pedestals with drawn names, buzz lights. Click "Tap to start the show" once for sound. |
| `/host` | You, on your phone | Enter the PIN. Shows the answer, who buzzed first, right/wrong buttons, timer, Daily Double wager, Final Jeopardy controls. |
| `/play` | One phone per team | Pick a team, draw your name, then buzz. Final Jeopardy: type a wager and draw your answer. |

## Host PIN
Default PIN is `orgo`. On Render, add an environment variable `HOST_PIN` to set your own.

## Run on your computer (optional test)
```
node server.js
```
Open http://localhost:3000 (screen), /host, and /play.

## Deploy on Render
Push this folder to a GitHub repo (package.json at the top level), then in Render choose
New > Web Service, connect the repo, Language: Node, Build: `npm install`, Start: `npm start`, Instance: Free.

## Notes
- Game state lives in the server's memory. If Render restarts the service, the game resets (phones re-send their drawn names automatically).
- Free Render services sleep after 15 idle minutes: open the screen page 10-15 minutes before you start.
- Early buzzes are allowed as soon as a clue is on screen; the first tap to reach the server wins.
