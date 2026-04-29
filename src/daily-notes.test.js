import { expect, test, describe, beforeAll } from "vitest";
import {
  getDailyNoteSettings,
  isDailyNotesEnabled,
  getTodaysDailyNote,
} from "./daily-notes";

// Minimal moment polyfill for tests so the helper can be tested headless.
// vitest runs in Node by default — set up a window shim before any helper
// calls execute. moment is reached via the obsidian-daily-notes-interface
// transitive dep that already ships with the project.
beforeAll(async () => {
  const m = await import(
    /* @vite-ignore */
    "../node_modules/.pnpm/moment@2.29.4/node_modules/moment/moment.js"
  );
  const moment = m.default || m;
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {};
  }
  if (!globalThis.window.moment) {
    globalThis.window.moment = moment;
  }
});

const fakeFile = (path) => ({
  path,
  basename: path.split("/").pop().replace(/\.md$/, ""),
  extension: "md",
});

const buildApp = ({ pn, core, files = [] } = {}) => ({
  vault: { getMarkdownFiles: () => files },
  internalPlugins: { plugins: { "daily-notes": core || null } },
  plugins: { getPlugin: (name) => (name === "periodic-notes" ? pn : null) },
});

describe("getDailyNoteSettings — Periodic Notes 1.0+ (calendar set)", () => {
  test("reads from calendarSetManager.getActiveSet().daily", () => {
    const app = buildApp({
      pn: {
        calendarSetManager: {
          getActiveSet: () => ({
            daily: {
              enabled: true,
              folder: "/Daily/",
              format: "YYYY/MM-MMM/YYYY-MM-DD",
              templatePath: "Templates/Daily.md",
            },
          }),
        },
      },
    });
    const s = getDailyNoteSettings(app);
    expect(s).toEqual({
      folder: "Daily",
      format: "YYYY/MM-MMM/YYYY-MM-DD",
      template: "Templates/Daily.md",
    });
  });

  test("returns sane defaults if calendar set has no daily entry", () => {
    const app = buildApp({
      pn: {
        calendarSetManager: { getActiveSet: () => ({ weekly: {} }) },
      },
      core: { enabled: false },
    });
    expect(getDailyNoteSettings(app)).toEqual({
      folder: "",
      format: "YYYY-MM-DD",
      template: "",
    });
  });
});

describe("getDailyNoteSettings — Periodic Notes 0.x (legacy flat shape)", () => {
  test("reads from plugin.settings.daily when enabled", () => {
    const app = buildApp({
      pn: {
        settings: {
          daily: {
            enabled: true,
            folder: "Diary",
            format: "YYYY-MM-DD",
            template: "templates/diary.md",
          },
        },
      },
    });
    expect(getDailyNoteSettings(app)).toEqual({
      folder: "Diary",
      format: "YYYY-MM-DD",
      template: "templates/diary.md",
    });
  });

  test("ignores legacy settings when daily is not enabled", () => {
    const app = buildApp({
      pn: { settings: { daily: { enabled: false, folder: "X" } } },
      core: {
        enabled: true,
        instance: {
          options: { folder: "core", format: "YYYY-MM-DD", template: "" },
        },
      },
    });
    expect(getDailyNoteSettings(app).folder).toBe("core");
  });
});

describe("getDailyNoteSettings — core Daily Notes plugin", () => {
  test("falls back to internalPlugins[daily-notes] when no Periodic Notes", () => {
    const app = buildApp({
      core: {
        enabled: true,
        instance: {
          options: {
            folder: "/dailies/",
            format: "DD-MM-YYYY",
            template: "tpl.md",
          },
        },
      },
    });
    expect(getDailyNoteSettings(app)).toEqual({
      folder: "dailies",
      format: "DD-MM-YYYY",
      template: "tpl.md",
    });
  });

  test("returns empty defaults when no plugin is enabled", () => {
    const app = buildApp({});
    expect(getDailyNoteSettings(app)).toEqual({
      folder: "",
      format: "YYYY-MM-DD",
      template: "",
    });
  });
});

describe("isDailyNotesEnabled", () => {
  test("true when core Daily Notes is enabled", () => {
    expect(isDailyNotesEnabled(buildApp({ core: { enabled: true } }))).toBe(
      true
    );
  });

  test("true when Periodic Notes 1.0 calendar set has daily enabled", () => {
    expect(
      isDailyNotesEnabled(
        buildApp({
          pn: {
            calendarSetManager: {
              getActiveSet: () => ({ daily: { enabled: true } }),
            },
          },
        })
      )
    ).toBe(true);
  });

  test("true when Periodic Notes 0.x flat settings have daily enabled", () => {
    expect(
      isDailyNotesEnabled(
        buildApp({ pn: { settings: { daily: { enabled: true } } } })
      )
    ).toBe(true);
  });

  test("false when neither plugin is configured", () => {
    expect(isDailyNotesEnabled(buildApp({}))).toBe(false);
  });

  test("safe against missing app object", () => {
    expect(isDailyNotesEnabled(null)).toBe(false);
  });
});

describe("getTodaysDailyNote", () => {
  test("returns the file whose basename parses as today's date", () => {
    const today = window.moment().format("YYYY-MM-DD");
    const yest = window.moment().subtract(1, "day").format("YYYY-MM-DD");
    const files = [
      fakeFile(`Daily/${yest}.md`),
      fakeFile(`Daily/${today}.md`),
    ];
    const app = buildApp({
      core: {
        enabled: true,
        instance: { options: { folder: "Daily", format: "YYYY-MM-DD" } },
      },
      files,
    });
    expect(getTodaysDailyNote(app)?.path).toBe(`Daily/${today}.md`);
  });

  test("returns null if today has no daily note", () => {
    const yest = window.moment().subtract(1, "day").format("YYYY-MM-DD");
    const app = buildApp({
      core: {
        enabled: true,
        instance: { options: { folder: "Daily", format: "YYYY-MM-DD" } },
      },
      files: [fakeFile(`Daily/${yest}.md`)],
    });
    expect(getTodaysDailyNote(app)).toBe(null);
  });

  test("ignores files outside the configured folder", () => {
    const today = window.moment().format("YYYY-MM-DD");
    const app = buildApp({
      core: {
        enabled: true,
        instance: { options: { folder: "Daily", format: "YYYY-MM-DD" } },
      },
      files: [fakeFile(`Other/${today}.md`)],
    });
    expect(getTodaysDailyNote(app)).toBe(null);
  });
});
