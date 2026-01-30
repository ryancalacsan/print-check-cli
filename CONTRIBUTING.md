# Contributing to print-check-cli

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

**Prerequisites:** Node.js >= 20

```bash
# Clone the repo
git clone https://github.com/ryancalacsan/print-check-cli.git
cd print-check-cli

# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI in development mode (no build step needed)
npm run dev -- <file.pdf>
```

## Available Scripts

| Script                  | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run dev -- <file>` | Run the CLI directly via tsx         |
| `npm run build`         | Build with tsup to `dist/`           |
| `npm test`              | Run tests with Vitest                |
| `npm run test:coverage` | Run tests with coverage report       |
| `npm run lint`          | Lint `src/` and `tests/` with ESLint |
| `npm run format`        | Format all files with Prettier       |
| `npm run format:check`  | Check formatting without writing     |

## Coding Standards

This project uses ESLint and Prettier to enforce consistent code style. Both run in CI.

- **Formatting:** Prettier with double quotes, semicolons, 100 char line width, trailing commas
- **Linting:** ESLint with TypeScript recommended rules
- **Unused parameters:** Prefix with underscore (e.g., `_unusedParam`)

Before committing, make sure your code passes:

```bash
npm run lint
npm run format:check
```

Or auto-fix formatting with:

```bash
npm run format
```

## Running Tests

Tests use [Vitest](https://vitest.dev/) and are located in the `tests/` directory.

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npx vitest run tests/checks.test.ts
```

Coverage thresholds are enforced in CI. If you add new source code, add corresponding tests to maintain coverage.

## Commit Messages

Follow this format:

```
<Verb> <short description>
```

- Start with a present-tense verb: `Add`, `Fix`, `Update`, `Remove`, `Refactor`
- Keep the first line under 72 characters
- No period at the end
- Be specific about what changed

**Examples:**

```
Add font subsetting detection to font check
Fix false positive in bleed calculation for A4 pages
Update coverage thresholds after adding reporter tests
```

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes and add tests if applicable
3. Ensure all checks pass:
   ```bash
   npm run build
   npm run lint
   npm run format:check
   npm test
   ```
4. Open a PR using the provided template
5. Link any related issues with `Closes #<number>`

## Project Structure

```
src/
  checks/        # Individual check implementations
  engine/        # PDF loading and utility functions
  reporter/      # Output formatting (console, JSON)
  config.ts      # Config file discovery and loading
  profiles.ts    # Built-in check profiles
  types.ts       # Shared TypeScript types
  index.ts       # CLI entry point
tests/
  helpers/       # PDF fixture generators
  checks.test.ts # Check unit tests
  cli.test.ts    # CLI integration tests
  config.test.ts # Config loading tests
  reporter.test.ts # Reporter unit tests
```

## Questions?

Open an [issue](https://github.com/ryancalacsan/print-check-cli/issues) if something is unclear or you'd like to discuss an idea before starting work.
