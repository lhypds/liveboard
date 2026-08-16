Data API
========


A component can keep a `data/` folder next to its code, filled by its own fetch
script. The Data API serves that folder over HTTP, so a card reads the files as
they are on disk **now** — not as they were when the board was last built.

`server/data.ts` is the Vite plugin behind it. `vite.config.ts` registers it for
the dev server and for `vite preview`, which is what a production board runs
under pm2, so it answers the same in both.


Why not just import the files
-----------------------------

Fetched data is gitignored and only exists once a script has run on that
machine, so a card cannot `import` it directly — the build would fail on a board
that has never fetched. The way around that used to be `import.meta.glob`, which
resolves at **build** time. That has two costs:

- A fetch that runs after the build is invisible until the next build. On a
  production board, a nightly crawl showed yesterday's news until someone
  rebuilt.
- Every file kept on disk is bundled, read or not. An archive of daily files
  grew the bundle a little every day, which is why the fetch scripts prune.

Read over the API instead, and `fetch.sh` is enough on its own: the card's
Refresh button re-reads the folder, so whatever the last crawl wrote is on
screen without a rebuild.


Endpoints
---------

```
GET /api/data/<module>            list the files in that component's data folder
GET /api/data/<module>/<file>     return one of them
```

Listing:

```
$ curl localhost:4173/api/data/News
{"module":"News","files":["2026-08-15.json"]}
```

A file comes back as itself, with the content type its extension implies and
`Cache-Control: no-store` — a cached copy would undo the whole point:

```
$ curl localhost:4173/api/data/News/2026-08-15.json
{ "date": "2026-08-15", "fetchedAt": "2026-08-14T19:46:31.998Z", … }
```

`GET` and `HEAD` only. `.json`, `.txt` and `.csv` only — a `.mjs`, an `.env` or
a half-written `.tmp` in the same folder is neither listed nor served.

The folder is found by name: the plugin looks for
`src/modules/<repo>/<module>/data` across every cloned module repo, the same
lookup the Refresh API uses. A component is reached by its own folder name
(`News`), never by its repo, so nothing changes when a component moves repos.

| Status | When                                                       |
|--------|------------------------------------------------------------|
| 400    | module name outside `[\w-]+`, or a file name carrying a separator, a leading dot, or an extension that is not served |
| 404    | that component has no `data/` folder, or no such file in it |
| 405    | anything other than `GET`/`HEAD`                            |


Reading it from a card
----------------------

`@services/data` (`src/services/data.ts`) is the browser side. It lives in the
board rather than in one module repo because the contract is the board's — any
component, in any repo, reaches its own data the same way.

```ts
listData(module)                 // string[]  — file names, sorted; [] if never fetched
loadJson<T>(module, file)        // T | null  — null when missing or unreadable
loadText(module, file)           // string | null — for .txt and .csv
datesFrom(files)                 // the YYYY-MM-DD.json names, newest first
```

Nothing throws on a folder that isn't there. A board that has never fetched gets
an empty list and a null day, and the card says "no data yet" instead of
breaking the page. `News/data.ts` is the whole pattern:

```ts
import { datesFrom, listData, loadJson } from "@services/data";

const MODULE = "News";

/** The days crawled so far, newest first. */
export async function loadDates(): Promise<string[]> {
  return datesFrom(await listData(MODULE));
}

export async function loadDay(date: string): Promise<NewsDay | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = await loadJson<NewsDay>(MODULE, `${date}.json`);
  // A hand-edited or half-written file should read as "no news yet".
  return Array.isArray(day?.items) ? day : null;
}
```

The card then lists in one effect and loads the day it is showing in another —
one request per day looked at, so the archive on disk costs nothing until
someone picks a day out of it.


Data flow
---------

```
Writing — a fetch script fills the folder

    cron        deploy
      │           │
      └───────────┴──►  refresh.sh ──► fetch.mjs
                                          │
                                          ▼
                           src/modules/<repo>/News/data/2026-08-15.json

Reading — a card asks for it, at request time

    News.tsx ──► News/data.ts ──► @services/data ─┬─► GET /api/data/News
       ▲                                          │     {"files":["2026-08-15.json", …]}
       │                                          └─► GET /api/data/News/2026-08-15.json
       │                                                the file, straight off disk
    Refresh button (card header) — the same two reads, again
```

`server/data.ts` reads that folder on each request. Nothing is bundled, so a
file written a minute ago is served now, and one deleted is out of the listing
just as fast.

The two APIs pair up: `POST /api/refresh?module=<module>` runs the script that
**writes** the folder, and the Data API **reads** it. Neither needs a build, so
on a production board a crawl shows up as soon as a card reads again.

The card header's Refresh button is on the reading side only — it re-runs the
card's own reads (see `_setRefresh` in `src/pages/Home/Home.tsx`) and never the
refresh API, so a click costs a couple of requests to the board's own server
rather than a crawl. Writing the folder stays with cron, a deploy, or running
`refresh.sh` by hand.


Scheduling
----------

`./cron-install.sh` puts a component's crawl on a schedule; `./cron-uninstall.sh`
takes it off again. Run them on the box the board is deployed to, after
`./setup.sh` has cloned the module repos.

With nothing after them they ask, offering a list at each step — which module
repo, which component in it, which of that component's scripts, any arguments,
and how often:

```
==> 1/4  Which module repo?          ==> 4/4  How often should it run?
   1) basic                             1) Every 15 minutes      */15 * * * *
   2) data                              2) Every hour            0 * * * *
   3) eitai                             …
Choose [1-3, q to quit]: 2             10) Custom — type a cron expression
```

Every answer can be given up front instead, which is what a deploy script wants:

```bash
./cron-install.sh News --schedule "0 */4 * * *" -- --force
./cron-install.sh --all                           # every component with a refresh.sh, 06:00 daily
./cron-install.sh --list                          # what this board has installed
./cron-uninstall.sh News                          # or --all
```

Output goes to `logs/cron-<component>.log` (gitignored). Both scripts are
idempotent and tag every line they write with `# liveboard:<board dir>:<component>`,
so they only ever replace or remove their own — another board on the same
machine, and anything else in the crontab, is left alone. The crontab is saved
to `logs/crontab.bak` before either script rewrites it.

Two things that bite when a crawl works by hand and not from cron:

- **PATH.** cron gives a job almost nothing, and `node` is usually under nvm.
  Each line pins the directories `node` and `ft` were found in *at install time*,
  so run `cron-install.sh` from a shell where `node -v` works.
- **A fetch that no-ops.** Most of these stop as soon as they see today's file,
  which is what makes them safe to call from a deploy — but it also means
  scheduling one several times a day does nothing without `-- --force`.


Notes
-----

- **Dev does not reload on a write.** The files are no longer part of the module
  graph, so writing one while `npm run dev` is running leaves the page alone —
  the card picks it up on its next read.
- **Component names are the address.** Two components in different repos sharing
  a folder name would share a route; the first repo found wins. Names are
  already unique across the registry, so this only matters when adding one.
- **Prune anyway.** The card only reads the day it shows, so an old file costs
  nothing to serve, but it is still disk nobody looks at. The fetch scripts keep
  a bounded window (`NEWS_KEEP_DAYS`, `GITHUB_RANKING_KEEP_DAYS`).
- **Not for secrets.** Anything in a `data/` folder with a served extension is
  public to anyone who can reach the board. Credentials belong in the
  component's `.env`, which the fetch script reads and the browser never sees.


Using it in a new component
---------------------------

1. Have the fetch script write into `data/` beside the component, in `.json`,
   `.txt` or `.csv`.
2. Read it through `@services/data` — no import, no glob, no build step.
3. Handle the empty case: an unfetched board is the normal first state, not an
   error.

`News` and `GitHubRanking` (in the `data` module repo) both work this way;
`GitHubRanking` also shows the mixed case, where dated files and one growing
`repositories.json` sit in the same folder.
