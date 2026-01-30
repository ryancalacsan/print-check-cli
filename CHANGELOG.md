# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/ryancalacsan/print-check-cli/releases/tag/v1.0.0
