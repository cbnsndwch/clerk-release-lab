# Development and privacy

Tooling uses pnpm 12.5.1, Node 24+, and Oxc (`oxlint` and `oxfmt`).
`.nvmrc`, EditorConfig, and explicit Oxc configs keep local editing and CI
consistent. App and test source use TypeScript with strict checking. Node 24 runs
the server and tests directly; esbuild bundles the React TSX client. Generated
email exports remain self-contained JavaScript modules for portability.
CI installs from the frozen pnpm lockfile and cancels superseded runs.

```sh
pnpm doctor # read-only checklist; run pnpm start in another terminal first
pnpm lint
pnpm typecheck
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test
pnpm gate
```

`pnpm gate` (also available as `pnpm check`) runs formatting, linting, strict TypeScript checking, the build
and Node test suite, and the privacy audit. Stage new source files before running
the privacy audit so it can inspect the intended Git contents.

Tests use synthetic provider responses; they do not send email or approve live OAuth requests. The privacy check inspects staged and tracked files, tracked working copies, and all reachable Git commit blobs for common credentials, real-looking Clerk identifiers, instance domains, temporary tunnel URLs, forbidden runtime files, and image metadata. It is a guardrail, not a proof that arbitrary personal content is safe to publish.

Keep `.env.local`, `.local/`, downloads, personal screenshots, original footage, and runtime state out of Git. Email state contains recipients and attachment contents. Browser drafts remain in localStorage. OAuth tokens remain in memory; configuration identifiers are stored only under `.local/`. Runtime instance IDs displayed by the UI are loaded from the viewer's own configured instance, not bundled into this repository.

Only an allowlisted source extraction and generated sample assets are included; no parent application history, captured demo screenshots, messages, or runtime state are part of this repository. The synthetic GIFs can be regenerated with `python scripts/generate-assets.py` after installing Pillow; Python is not needed to run the app. Code and synthetic assets are MIT licensed.

## Source map

- `scripts/demo/composer.tsx`: editor and navigation.
- `scripts/demo/start-here.tsx`: newcomer tour and setup checklist.
- `scripts/demo/setup.ts`: read-only readiness report used by the UI and doctor.
- `scripts/demo/model.ts` and `render.ts`: document schema, validation, and React Email rendering.
- `scripts/demo/email.ts`: local server, send/retry state, and restricted asset service.
- `scripts/demo/auth.ts`: device authorization, CIMD, and minimal MCP server/client.
- `scripts/demo/types.ts`: shared application types.
- `scripts/doctor.ts`: CLI client of the local setup endpoint.

Doctor is optional and not part of the gate; it requires a running server. Adding
credentials does not make tests use live Clerk. Use synthetic values in tests and
keep personal setup in ignored runtime files.
