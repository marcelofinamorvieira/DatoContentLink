# Payload Inspection Scripts

Utility scripts you can run locally to confirm the stega payloads returned by DatoCMS contain the metadata you expect. Each script uses the same environment variables as the test suite (`DATOCMS_VISUAL_EDITING_BASE_URL`, `DATOCMS_VISUAL_EDITING_TOKEN`, and optionally `DATOCMS_VISUAL_EDITING_GRAPHQL_URL`).

All scripts load `.env`, `.env.local`, `.env.visual-editing`, or `test/.env` automatically, so drop your credentials there before running.

## Available scripts

| Script | Description |
| --- | --- |
| `node fetch-upload-alts.mjs` | Fetches `allUploads` and prints the decoded metadata from each `alt` value. Useful for verifying direct upload payloads. |
| `node fetch-hero-image.mjs` | Runs the homepage query and inspects `home.sections[].heroImage.alt`. Shows the decoded payload alongside the visible alt. |
| `node fetch-hero-title.mjs` | Runs the homepage query and prints both the decoded `heroTitle` payload and the corresponding `heroImage.alt`, demonstrating record-level metadata. |

Each script logs the visible label, the decoded `editUrl`, and the raw identifiers returned by `decodeStega`. If an entry is missing `itemId`, you will see it rendered as an empty string—handy for diagnosing partial payloads.

Feel free to copy these patterns to build your own sanity checks (for example, iterating over other sections or datasets).
