[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/tuyulsembilanenam672-cell/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/tuyulsembilanenam672-cell/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# csv-reader-fast

A faster drop-in for make.fun's csv-reader 1.0.0. `solve.js` exports `run(input)`,
which returns exactly csv-reader 1.0.0's answer `{columns, rows, errors}` for every
`{text, header}` input, reading fields as slices between delimiters instead of one
character at a time. `main.ts` reads every case from `/input/cases.json`, answers each
with `run`, and writes `/output/answers.json`.
