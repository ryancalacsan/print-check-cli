# print-check-cli

[![npm](https://img.shields.io/npm/v/print-check-cli)](https://www.npmjs.com/package/print-check-cli)
[![CI](https://github.com/ryancalacsan/print-check-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ryancalacsan/print-check-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ryancalacsan/print-check-cli/graph/badge.svg)](https://codecov.io/gh/ryancalacsan/print-check-cli)

A Node.js + TypeScript CLI tool that validates print-ready PDF files. Runs eight checks and reports pass/warn/fail results in the terminal.

## Demo

![print-check demo](demo/demo.gif)

## Checks

| Check                  | What it validates                                                               |
| ---------------------- | ------------------------------------------------------------------------------- |
| **Bleed & Trim**       | TrimBox/BleedBox presence and minimum bleed dimensions                          |
| **Fonts**              | Font embedding status (embedded, subset, or missing)                            |
| **Color Space**        | CMYK compliance, RGB detection, spot color reporting                            |
| **Resolution**         | Raster image DPI against a configurable minimum                                 |
| **PDF/X Compliance**   | PDF/X standard detection (OutputIntents, version, output condition) — info only |
| **Total Ink Coverage** | Maximum ink density (C+M+Y+K %) against configurable limit                      |
| **Transparency**       | Detects unflattened transparency (groups, soft masks, blend modes)              |
| **Page Size**          | Verifies consistent page dimensions and optional expected size match            |

## Usage

```
print-check <file.pdf ...> [options]

Options:
  --min-dpi <number>       Minimum acceptable DPI (default: 300)
  --color-space <mode>     Expected color space: cmyk | any (default: cmyk)
  --bleed <mm>             Required bleed in mm (default: 3)
  --max-tac <percent>      Maximum total ink coverage % (default: 300)
  --page-size <WxH>        Expected page size in mm (e.g. 210x297)
  --checks <list>          Comma-separated checks to run (default: all)
  --severity <overrides>   Per-check severity: check:level,... (fail|warn|off)
  --profile <name>         Print profile: standard | magazine | newspaper | large-format
  --verbose                Show detailed per-page results
  --format <type>          Output format: text | json (default: text)
  -V, --version            Output version
  -h, --help               Show help
```

### Examples

```bash
# Run all checks with defaults
print-check flyer.pdf

# Verbose output with custom DPI threshold
print-check flyer.pdf --verbose --min-dpi 150

# Run only font and bleed checks
print-check flyer.pdf --checks fonts,bleed

# Skip color space enforcement
print-check flyer.pdf --color-space any

# JSON output for CI pipelines
print-check flyer.pdf --format json

# Use a built-in profile
print-check flyer.pdf --profile magazine

# Profile with explicit override
print-check flyer.pdf --profile newspaper --min-dpi 300

# Check multiple files at once
print-check flyer.pdf poster.pdf brochure.pdf

# Use shell globbing to check all PDFs in a directory
print-check *.pdf

# Multiple files with JSON output (outputs an array of reports)
print-check *.pdf --format json
```

### Profiles

Built-in profiles provide preset thresholds for common print scenarios. Explicit CLI flags override profile defaults.

| Profile        | minDpi | colorSpace | bleedMm | maxTac | Use case                           |
| -------------- | ------ | ---------- | ------- | ------ | ---------------------------------- |
| `standard`     | 300    | cmyk       | 3       | 300    | General commercial print (default) |
| `magazine`     | 300    | cmyk       | 5       | 300    | Magazine / perfect-bound           |
| `newspaper`    | 150    | any        | 0       | 240    | Newsprint / low-fidelity           |
| `large-format` | 150    | cmyk       | 5       | 300    | Banners, posters, signage          |

### Exit codes

- `0` — all checks passed (or warned)
- `1` — one or more checks failed

### Severity Overrides

Override the default severity for any check using `--severity`:

```bash
# Downgrade font failures to warnings (exit 0)
print-check flyer.pdf --severity fonts:warn

# Skip transparency check entirely
print-check flyer.pdf --severity transparency:off

# Multiple overrides
print-check flyer.pdf --severity fonts:warn,transparency:off
```

| Level  | Behavior                                       |
| ------ | ---------------------------------------------- |
| `fail` | Default — no change to check result            |
| `warn` | Downgrade any `fail` result to `warn` (exit 0) |
| `off`  | Skip the check entirely                        |

Available check names: `bleed`, `fonts`, `colorspace`, `resolution`, `pdfx`, `tac`, `transparency`, `pagesize`.

## Configuration

Create a config file to set default options for your project:

### `.printcheckrc` / `.printcheckrc.json`

```json
{
  "minDpi": 300,
  "colorSpace": "cmyk",
  "bleed": 5,
  "maxTac": 300,
  "checks": "bleed,fonts,colorspace",
  "profile": "magazine",
  "severity": {
    "fonts": "warn",
    "transparency": "off"
  }
}
```

### `printcheck.config.js`

```js
export default {
  minDpi: 150,
  colorSpace: "any",
  bleed: 0,
  profile: "newspaper",
};
```

Config files are auto-discovered from the current directory upward.
CLI flags always override config file values.

## Tech Stack

| Package                                                 | Purpose                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| [mupdf](https://www.npmjs.com/package/mupdf) (mupdf.js) | PDF engine — WASM-powered, deep PDF object traversal        |
| [pdf-lib](https://www.npmjs.com/package/pdf-lib)        | Supplemental — reading page boxes (TrimBox, BleedBox, etc.) |
| [commander](https://www.npmjs.com/package/commander)    | CLI framework                                               |
| [picocolors](https://www.npmjs.com/package/picocolors)  | Terminal colors                                             |
| [zod](https://www.npmjs.com/package/zod)                | CLI option validation                                       |
| [tsup](https://www.npmjs.com/package/tsup)              | TypeScript build                                            |
| [vitest](https://www.npmjs.com/package/vitest)          | Testing                                                     |

## Project Structure

```
src/
├── index.ts                # CLI entry point (Commander setup)
├── types.ts                # Shared interfaces (CheckResult, CheckOptions, etc.)
├── checks/
│   ├── index.ts            # Re-exports all checks
│   ├── bleed-trim.ts       # Page box validation (pdf-lib)
│   ├── fonts.ts            # Font embedding check (mupdf)
│   ├── colorspace.ts       # Color space detection (mupdf)
│   ├── resolution.ts       # Image DPI check (mupdf)
│   ├── pdfx-compliance.ts  # PDF/X standard detection (mupdf)
│   ├── tac.ts              # Total ink coverage check (mupdf)
│   ├── transparency.ts     # Transparency detection check (mupdf)
│   └── page-size.ts        # Page size consistency check (pdf-lib)
├── engine/
│   ├── pdf-engine.ts       # Unified PDF document loader (mupdf + pdf-lib)
│   └── pdf-utils.ts        # Safe wrappers for mupdf PDFObject API
└── reporter/
    ├── console.ts          # Terminal output formatter
    └── json.ts             # JSON output formatter (--format json)
```

## Development

```bash
npm install           # Install dependencies (also sets up pre-commit hooks)
npm run dev -- <file> # Run via tsx (no build needed)
npm run build         # Build to dist/
npm test              # Run vitest
npm run test:coverage # Run with coverage report
npm run lint          # ESLint
npm run format:check  # Prettier check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development guidelines.

## Known Limitations (MVP)

- **mupdf PDFObject nulls** — mupdf.js returns PDFObject wrappers with `.isNull() === true` rather than JavaScript `null`. All mupdf access goes through `src/engine/pdf-utils.ts` safe wrappers to handle this.
