# Employee Training Tracker

Web app giving an overview of employee training status (validity, upcoming expirations,
what needs attention) and recommending whom to enrol in which limited-capacity term.

Everything runs in the browser: the four CSV exports are read locally and never leave the
machine. The demo button loads a small synthetic dataset from `tests/fixtures/`.

## Run locally

Requires Node.js 24+.

```bash
npm install
npm run dev        # development server with hot reload → http://localhost:5173/
```

Production build, served the same way as on GitHub Pages (relative base path):

```bash
npm run build
npm run preview    # → http://localhost:4173/
```

Checks (the same as CI):

```bash
npm run typecheck
npm run lint
npm test
```

## Using the app

- **Načíst ukázková data** loads the synthetic demo dataset.
- Or pick all four CSV exports at once (any file names, any order). Files are recognised by
  their header; encoding (UTF-8 / Windows-1250) and delimiter (`,` / `;`) are detected.
- Results are computed as of the export date 1 October 2026. The "expiring soon" window
  can be switched between 30, 60 and 90 days.
- Tabs: what to deal with · employees · enrolment recommendation · sessions · data quality.

Expected numbers for the demo dataset (60-day window): 7 employees in the overview
(1 terminated left out); trainings valid 9 / expiring 1 / expired 4 / missing 6;
7 enrolments recommended, 4 not possible (2 parental leave, 2 capacity), 1 requirement
undecidable (missing department).

## Structure

- `src/domain` – pure domain rules (validity, requirements, allocation), no React.
- `src/use-cases` – dataset loading, training overview, enrolment recommendation.
- `src/infrastructure/csv` – decoding, parsing and recognising CSV files.
- `src/app` – composition: files → dataset → overview and plan; demo dataset.
- `src/ui` – React components; presentation logic in `src/ui/model` (tested without a DOM).
