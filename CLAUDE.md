# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # watch mode build (dev)
pnpm build        # production build → main.js
pnpm test         # run all tests (vitest)
pnpm test -- --reporter=verbose   # run tests with details
pnpm format       # prettier format
```

Run a single test by name:

```bash
pnpm test -- -t "single todo element"
```

## Architecture

This is an [Obsidian](https://obsidian.md) plugin. Obsidian plugins must ship as a CommonJS bundle at `main.js` (built by rollup from `src/index.js`). The `obsidian` import is external (provided by Obsidian at runtime).

**Core files:**

- `src/index.js` — `RolloverTodosPlugin` class (extends `Plugin`). Handles plugin lifecycle (`onload`), vault event registration, commands ("Rollover Todos Now", "Undo last rollover"), and the top-level `rollover()` orchestration logic.
- `src/get-todos.js` — `TodoParser` class + `getTodos()` export. Pure logic: given an array of markdown lines, returns unfinished todo lines. Uses `Intl.Segmenter` for correct Unicode grapheme cluster handling (emoji, combining characters in checkbox content).
- `src/ui/RolloverSettingTab.js` — Obsidian `PluginSettingTab` for the settings panel.
- `src/ui/UndoModal.js` — Obsidian `Modal` for the undo confirmation dialog.

**Plugin settings** (defaults in `loadSettings`):

- `templateHeading` — heading to insert todos under (or `"none"` for end of file)
- `deleteOnComplete` — remove rolled-over todos from the previous day's note
- `removeEmptyTodos` — skip empty `- [ ]` items
- `rolloverChildren` — include indented child items under a todo
- `rolloverOnFileCreate` — auto-trigger on vault `create` event
- `doneStatusMarkers` — string of characters treated as "done" (default `"xX-"`)
- `leadingNewLine` — add a newline before todos when inserting under a heading

**Rollover flow:** On daily note creation (or manual command), `rollover()` validates the file is today's daily note (created within 5 seconds), finds the previous daily note via `getLastDailyNote()`, extracts unfinished todos via `getAllUnfinishedTodos()`, then appends them to today's note (optionally under a template heading). Undo history is kept for 2 minutes.

**Testing:** Tests live in `src/get-todos.test.js` and cover only the pure `getTodos()` function (no Obsidian API involved). The plugin's vault/UI logic has no tests.

## Fork and upstream relationship

This is a personal fork of `git@github.com:lumoe/obsidian-rollover-daily-todos.git` (the upstream Obsidian community plugin).

**Branching strategy:**

- `main` — primary branch for this fork. Upstream's `master` changes are selectively cherry-picked here.
- `master` — tracks the upstream `master` branch (kept in sync to make cherry-picking straightforward).
- `release/v1.3.0` — upstream's WIP branch with significant behavioral changes that have not been evaluated yet. Do not merge or cherry-pick from this branch until it has been tested. Keep it around for future reference.

When pulling in upstream changes: fetch from upstream into `master`, then cherry-pick individual commits onto `main`. Avoid bulk-merging `master` → `main` to stay in control of what behavioral changes are adopted.
