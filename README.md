# Schedule Maker

A weekly planner that runs in the browser. Build a schedule from a screenshot of your class list, then add work, workouts, study blocks and anything else. Drag blocks to reschedule, see overlaps at a glance, and export to a calendar.

## Features

- **Screenshot import**: drop, paste or upload a class table; the courses and times are read for you
- **Block types**: Class, Work, Workout, Study and a renamable "Other", each with the fields that make sense (room, address, link, notes)
- **Drag to move, drag the bottom edge to resize**, snapping to 15 minutes; click a block to edit or delete it
- **Overlap warnings**: clashing blocks sit side by side, are outlined in red, and are listed in a banner
- **Multiple schedules**: for example one per semester, each with its own term dates
- **Calendar export**: CSV for Google Calendar or Outlook, or a ZIP with one CSV per schedule; per-class Google Calendar links
- **Other exports**: PNG image, JSON backup/restore, print view
- Data is stored in your browser (`localStorage`); nothing is uploaded except screenshots you choose to read

## Project structure

```
index.html
styles.css
app.js
package.json              ({ "type": "module" }, needed by the API function)
api/parse-schedule.js     (optional: screenshot reading)
```

## Run locally

The page itself is static. From the project folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Open the address it prints. Everything works except screenshot reading; **Load example** and **+ Add block** work without a server.

To test screenshot reading locally, use the Vercel CLI, which runs the page and `api/` together:

```bash
npm i -g vercel
vercel dev
```

## Enable screenshot reading (optional, paid)

Everything in the app works without this section: **Load example**, **+ Add block**, drag and drop, exports and calendar import are all free and need no server. Only reading a pasted or uploaded screenshot needs it.

This feature calls the Anthropic API, which is billed per use with prepaid credits. A Claude.ai Pro or Max subscription does not include API credits. New accounts may get a small one-time starter credit, but check the Console for current terms and pricing. Set a monthly spend limit before you deploy.

The page sends the image to `/api/parse-schedule`, which calls the Anthropic API. The API key must stay on the server.

1. Create an API key in the Claude Console (docs: https://docs.claude.com).
2. In the Console, set a monthly spend limit.
3. Deploy the repo to Vercel (import the GitHub repo; no build settings needed).
4. In the Vercel project, add the environment variable `ANTHROPIC_API_KEY` and redeploy.

For local development, create a `.env.local` file (never commit it):

```
ANTHROPIC_API_KEY=your-key-here
```

Add `.env*` to `.gitignore`.

### Configuration

| Setting | Where | Default |
|---|---|---|
| `PARSE_ENDPOINT` | top of `app.js` | `/api/parse-schedule` |
| Model | `api/parse-schedule.js` | `claude-sonnet-5-5` |

If the page is hosted somewhere other than the function (for example GitHub Pages), set `PARSE_ENDPOINT` to the function's full URL and allow that origin with CORS headers in the function.

Because the endpoint spends your credits, add a rate limit or origin check before sharing the site publicly.

## Importing into a calendar

1. Click **Add to calendar**.
2. Tick the schedules to export and set each one's term start and end dates.
3. Download the CSV (or the ZIP if several are ticked).
4. In Google Calendar on a computer: Settings, then **Import & export**, and import each file into a **new calendar** (for example "Fall 2026"). Each calendar can then be shown or hidden on any device.

When your schedule changes, delete the old calendar and import the new file into a fresh one, otherwise you'll get duplicates. The calendar mobile apps can't import files; do this step on a computer.

There is no live subscription feed. Calendars update only when you re-import.

## Moving your data

Use **Export JSON** to back up a schedule, including its term dates and the name of the "Other" category. **Import JSON** always creates a new schedule from the file. Browser storage is separate for each site address, so use this to move schedules between the deployed site, a local copy and other devices.

## Troubleshooting

- **"Couldn't read that image"**: the API function isn't deployed or reachable, the key is missing, or the image is over about 4.5 MB. Check `PARSE_ENDPOINT` and the function logs.
- **ZIP won't download**: the JSZip script from the CDN didn't load; export one schedule at a time or host JSZip yourself.
- **Print does nothing**: some embedded views block printing; use **Export image** and print that.
- **Google Calendar links don't open**: your browser may be blocking pop-ups; use the CSV instead.

## Limitations

- Screenshot import creates classes only; add work, workouts and other blocks by hand.
- Overlaps are flagged but never blocked.
- The grid shows Monday to Saturday (Saturday only when it has blocks).