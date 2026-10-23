# Benchmark results

**Local measurement on one developer machine, not a CI number.** The machine was also running
other work (load average about 6), so expect noise; rerun with `npm run bench` in this directory.

## What is measured

`scripts/generate-routes.ts` writes 40 sections of 25 routes each (1,000 route files). The same test
file, `src/test/route.test.tsx`, renders `/section-20/page-12` twice: Vitest project `full` loads
the full `src/routeTree.gen.ts`, project `scoped` loads `src/test/route-trees/section-20.gen.js`.
`scripts/bench.ts` runs each project 5 times with `vitest run --reporter=json`, alternating the
two, and prints the median of:

- **process wall**: the whole `npx vitest run --project <name>` process, start to exit.
- **run start to file done**: from the JSON report's `startTime` to the test file's `endTime`
  (environment setup, importing the route tree, and the test itself).

## Results (milliseconds, median of 5 runs)

| Invocation | full: process wall | scoped: process wall | full: run to file done | scoped: run to file done |
| ---------- | -----------------: | -------------------: | ---------------------: | -----------------------: |
| 1          |               3216 |                 2398 |                   2392 |                     1741 |
| 2          |               3532 |                 1904 |                   2812 |                     1246 |
| 3          |               3625 |                 2588 |                   2945 |                     1946 |

Across the three invocations the scoped tree cut the process wall time by 0.8 to 1.6 s (25% to
46%). Both variants pay the same `npx` and Vitest startup inside the wall time. The
share of the remaining scoped time that is jsdom and Vitest startup was not measured.

## Machine and versions

- Apple M4 Pro, 12 cores, 24 GB, macOS 26.5.2
- Node 22.15.0, npm 10.9.2
- vitest 5.0.5, vite 8.3.4, jsdom 29.1.1
- react 19.3.1, @tanstack/react-router 1.170.44, @tanstack/router-plugin 1.168.46,
  @tanstack/router-generator 1.167.44
- Measured 2026-10-23
