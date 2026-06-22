# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.2] - 2026-06-22

### Fixed

- `--version` now reports the actual package version (was hardcoded to `1.0.0`); the version is read dynamically from `package.json` so it can no longer drift
- Resolved latent type errors in `safeForEach` and severity parsing (behavior-preserving)

### Changed

- Updated development dependencies and cleared all security advisories (`npm audit` reports 0 vulnerabilities)
- Upgraded to ESLint 10 and `@types/node` 26
- Bumped GitHub Actions `checkout` and `setup-node` to v5

### Added

- `typecheck` script (`tsc --noEmit`) wired into CI to catch type errors that the esbuild-based build and tests previously skipped

## [1.0.1] - 2026-01-30

### Added

- Demo terminal recording (GIF) in README
- CONTRIBUTING.md with development setup, coding standards, and PR guidelines
- Pre-commit hooks via husky and lint-staged (auto-lint and format on commit)
- Node 20 and 22 version matrix in CI
- Codecov integration with coverage badge
- Test coverage improvements: config tests, reporter tests, stroke-based PDF fixtures
- Coverage thresholds enforced in CI (80% lines, 67% branches)

## [1.0.0] - 2026-01-30

### Added

- CLI tool with 8 PDF validation checks:
  - **Fonts** — detects unembedded fonts
  - **Color Space** — flags non-CMYK colors (skips neutral RGB and annotations)
  - **Resolution** — checks image DPI using CTM-based calculation
  - **Bleed/Trim** — validates TrimBox and BleedBox dimensions
  - **PDF/X Compliance** — detects PDF/X standard conformance
  - **Total Area Coverage** — measures ink coverage per page
  - **Transparency** — detects transparent objects
  - **Page Size** — checks page size consistency across pages
- Configurable print profiles (`--profile standard|magazine|newspaper|large-format`)
- Batch file processing with variadic arguments
- JSON output format (`--format json`)
- Verbose mode (`--verbose`) with per-page detail lines
- Check filtering (`--checks fonts,resolution,...`)
- Per-check severity overrides (`--severity fonts:warn,transparency:off`)
- Config file support (`.printcheckrc`, `.printcheckrc.json`, `printcheck.config.js`)
- GitHub Actions CI/CD pipeline (build, test, publish)
- Trusted publishing to npm via OIDC (no token secrets)
- Provenance attestation on published packages
- GitHub issue and PR templates

[1.0.2]: https://github.com/ryancalacsan/print-check-cli/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/ryancalacsan/print-check-cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ryancalacsan/print-check-cli/releases/tag/v1.0.0
