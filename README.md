# print-check-cli

A Node.js + TypeScript CLI tool that validates print-ready PDF files. Runs four checks and reports pass/warn/fail results in the terminal.

## Checks

| Check | What it validates |
|---|---|
| **Bleed & Trim** | TrimBox/BleedBox presence and minimum bleed dimensions |
| **Fonts** | Font embedding status (embedded, subset, or missing) |
| **Color Space** | CMYK compliance, RGB detection, spot color reporting |
| **Resolution** | Raster image DPI against a configurable minimum |

## Usage

```
print-check <file.pdf> [options]

Options:
  --min-dpi <number>       Minimum acceptable DPI (default: 300)
  --color-space <mode>     Expected color space: cmyk | any (default: cmyk)
  --bleed <mm>             Required bleed in mm (default: 3)
  --checks <list>          Comma-separated checks to run (default: all)
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
```

### Profiles

Built-in profiles provide preset thresholds for common print scenarios. Explicit CLI flags override profile defaults.

| Profile | minDpi | colorSpace | bleedMm | Use case |
|---------|--------|------------|---------|----------|
| `standard` | 300 | cmyk | 3 | General commercial print (default) |
| `magazine` | 300 | cmyk | 5 | Magazine / perfect-bound |
| `newspaper` | 150 | any | 0 | Newsprint / low-fidelity |
| `large-format` | 150 | cmyk | 5 | Banners, posters, signage |

### Exit codes

- `0` — all checks passed (or warned)
- `1` — one or more checks failed

## Tech Stack

| Package | Purpose |
|---|---|
| [mupdf](https://www.npmjs.com/package/mupdf) (mupdf.js) | PDF engine — WASM-powered, deep PDF object traversal |
| [pdf-lib](https://www.npmjs.com/package/pdf-lib) | Supplemental — reading page boxes (TrimBox, BleedBox, etc.) |
| [commander](https://www.npmjs.com/package/commander) | CLI framework |
| [picocolors](https://www.npmjs.com/package/picocolors) | Terminal colors |
| [zod](https://www.npmjs.com/package/zod) | CLI option validation |
| [tsup](https://www.npmjs.com/package/tsup) | TypeScript build |
| [vitest](https://www.npmjs.com/package/vitest) | Testing |

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
│   └── resolution.ts       # Image DPI check (mupdf)
├── engine/
│   ├── pdf-engine.ts       # Unified PDF document loader (mupdf + pdf-lib)
│   └── pdf-utils.ts        # Safe wrappers for mupdf PDFObject API
└── reporter/
    ├── console.ts          # Terminal output formatter
    └── json.ts             # JSON output formatter (--format json)
```

## Development

```bash
npm install           # Install dependencies
npm run dev -- <file> # Run via tsx (no build needed)
npm run build         # Build to dist/
npm test              # Run vitest
```

## Known Limitations (MVP)

- **Resolution check** assumes each image fills the full page (conservative DPI estimate). Full CTM-based calculation is a post-MVP enhancement.
- **Color space check** inspects page resources and image XObjects but does not trace inline content stream operators (`rg`, `RG`, `k`, `K`).
- **mupdf PDFObject nulls** — mupdf.js returns PDFObject wrappers with `.isNull() === true` rather than JavaScript `null`. All mupdf access goes through `src/engine/pdf-utils.ts` safe wrappers to handle this.

## Roadmap

- [ ] CTM-based DPI calculation for accurate per-image resolution
- [ ] Content stream operator parsing for inline color space usage
- [x] JSON/CI-friendly output format (`--format json`)
- [x] Configurable profiles (`--profile magazine` with preset thresholds)
- [ ] PDF/X standard compliance detection
- [ ] Batch file processing (glob patterns)
