# Releasing

Lorebook Studio uses a simple pre-1.0 semantic versioning convention.

## Versioning

- `package.json` holds the source of truth: `MAJOR.MINOR.PATCH`.
- While pre-1.0, `MINOR` marks a feature release and `PATCH` marks a fix or small follow-up.
- Git tags use the `v` prefix and match `package.json` exactly (for example `0.5.2` -> `v0.5.2`).
- `CHANGELOG.md` must contain a `## [<version>]` entry for every release.

> Note: the `v1.5.1` tag predates this convention and does not match `package.json`. Use `v0.5.x` and later for new releases.

## Checklist

1. Update `version` in `package.json`.
2. Update the `app-version` meta tag in `index.html` to match.
3. Add a `## [<version>]` section to `CHANGELOG.md` and move finished entries out of `Unreleased`.
4. Run the full verification suite:
   - `npm run check`
   - `npm run lint`
   - `npm run format` (should report clean)
   - `npm test`
   - `npm run test:e2e`
   - `npm run release:check`
5. Commit the release changes.
6. Push `main`.
7. Create an annotated tag: `git tag -a v<version> -m "v<version> - <summary>"`.
8. Push the tag: `git push origin v<version>`.

## Verification scripts

- `npm run check` syntax-checks every JavaScript module.
- `npm run lint` enforces whitespace, indentation, and small code-quality rules.
- `npm run format` reports files that need whitespace normalization; `npm run format:write` applies fixes.
- `npm run release:check` verifies that `package.json`, the `index.html` app-version meta, `CHANGELOG.md`, and the tag on `HEAD` agree.
