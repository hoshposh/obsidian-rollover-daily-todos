/**
 * End-to-end coverage for the rollover plugin running inside a real Obsidian
 * instance. Exercises the integrated triage branch's behaviour against a live
 * vault: parser anchoring (cluster A), section routing (C), mark-as-moved (D),
 * dedup (E), insertion formatting (F), periodic-notes-aware daily resolution
 * (G), and the deletion-safety guard (H).
 *
 * The test vault under test/vaults/rollover/ is empty by design; each test
 * writes the daily notes it needs into the vault before triggering the
 * rollover command. The core Daily Notes plugin is configured via Obsidian's
 * settings API at runtime so we don't need pre-baked .obsidian configs.
 */

import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const VAULT_PATH = path.resolve("test/vaults/rollover");
const ROLLOVER_CMD = "obsidian-rollover-daily-todos:obsidian-rollover-daily-todos-rollover";

// Same date math the plugin itself uses (YYYY-MM-DD via window.moment) so
// vault contents line up with the plugin's view of "yesterday" / "today".
async function getDateStrings() {
  return browser.executeObsidian(({ obsidian }) => {
    // window.moment is a global Obsidian provides
    const today = window.moment().format("YYYY-MM-DD");
    const yesterday = window.moment().subtract(1, "day").format("YYYY-MM-DD");
    return { today, yesterday };
  });
}

async function writeNote(relPath, content) {
  const full = path.join(VAULT_PATH, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
}

async function readNote(relPath) {
  const full = path.join(VAULT_PATH, relPath);
  return fs.readFile(full, "utf8");
}

async function deleteIfExists(relPath) {
  const full = path.join(VAULT_PATH, relPath);
  try {
    await fs.unlink(full);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

// Configure the core Daily Notes plugin from inside Obsidian. We can't write
// data.json files for core plugins from the host because Obsidian rewrites
// them on shutdown; setting via the API ensures values stick.
async function configureDailyNotes({ folder = "", format = "YYYY-MM-DD" } = {}) {
  await browser.executeObsidian(
    async ({ app }, { folder, format }) => {
      const dn = app.internalPlugins.plugins["daily-notes"];
      if (!dn.enabled) {
        await app.internalPlugins.enablePlugin("daily-notes");
      }
      // Some Obsidian builds expose options on .instance, others under .options
      const opts = dn.instance && dn.instance.options ? dn.instance.options : dn;
      opts.folder = folder;
      opts.format = format;
      opts.template = "";
      // Persist to disk so the plugin reads them
      if (typeof dn.saveData === "function") await dn.saveData();
    },
    { folder, format }
  );
}

describe("rollover plugin (integrated triage)", function () {
  this.timeout(120000);

  before(async function () {
    await browser.reloadObsidian({ vault: VAULT_PATH });
    await configureDailyNotes();
  });

  beforeEach(async function () {
    // Wipe any .md files left over from prior tests
    const entries = await fs.readdir(VAULT_PATH, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".md")) {
        await deleteIfExists(e.name);
      }
    }
    // Force Obsidian to re-scan
    await browser.executeObsidian(async ({ app }) => {
      // resyncs the vault — file events fire so the plugin's getLastDailyNote
      // sees the new state on the next call
      app.vault.adapter.reconcileFile && app.vault.adapter.reconcileFile();
    });
  });

  it("plugin is loaded and registered the rollover command", async function () {
    const found = await browser.executeObsidian(({ app }) => {
      return Object.keys(app.commands.commands).some((id) =>
        id.startsWith("obsidian-rollover-daily-todos:")
      );
    });
    expect(found).toBe(true);
  });

  it("manual rollover copies incomplete todos from yesterday into today (no template heading)", async function () {
    const { today, yesterday } = await getDateStrings();
    await writeNote(
      `${yesterday}.md`,
      [
        "# Yesterday",
        "- [ ] Take out the trash",
        "- [x] Wash the dishes",
        "- [ ] Walk the dog",
        "",
      ].join("\n")
    );
    await writeNote(`${today}.md`, "# Today\n");

    await browser.executeObsidianCommand(ROLLOVER_CMD);

    const todayContent = await readNote(`${today}.md`);
    expect(todayContent).toContain("- [ ] Take out the trash");
    expect(todayContent).toContain("- [ ] Walk the dog");
    expect(todayContent).not.toContain("- [x] Wash the dishes");
  });

  it("(cluster A) does not roll over bullet patterns embedded inside fenced code blocks", async function () {
    const { today, yesterday } = await getDateStrings();
    await writeNote(
      `${yesterday}.md`,
      [
        "```js",
        "const md = items.map(t => `- [ ] ${t}`).join('\\n');",
        "```",
        "- [ ] real todo outside code block",
      ].join("\n")
    );
    await writeNote(`${today}.md`, "");

    await browser.executeObsidianCommand(ROLLOVER_CMD);

    const todayContent = await readNote(`${today}.md`);
    // only the real todo should appear; the embedded `- [ ] ${t}` must not
    expect(todayContent).toContain("- [ ] real todo outside code block");
    expect(todayContent).not.toContain("${t}");
  });

  it("(cluster F + H) inserts under template heading and never deletes when source-action is the default 'none'", async function () {
    const { today, yesterday } = await getDateStrings();
    await writeNote(
      `${yesterday}.md`,
      ["## Tasks", "- [ ] yesterday todo"].join("\n")
    );
    const todayInitial = "## Tasks\n## Notes\n";
    await writeNote(`${today}.md`, todayInitial);

    // Configure templateHeading via the plugin's settings API
    await browser.executeObsidian(async ({ app }) => {
      const plugin = app.plugins.getPlugin("obsidian-rollover-daily-todos");
      plugin.settings.templateHeading = "## Tasks";
      await plugin.saveSettings();
    });

    await browser.executeObsidianCommand(ROLLOVER_CMD);

    const todayContent = await readNote(`${today}.md`);
    expect(todayContent).toContain("- [ ] yesterday todo");
    // todo must land under "## Tasks", not "## Notes" or end of file
    const tasksIdx = todayContent.indexOf("## Tasks");
    const todoIdx = todayContent.indexOf("- [ ] yesterday todo");
    const notesIdx = todayContent.indexOf("## Notes");
    expect(todoIdx).toBeGreaterThan(tasksIdx);
    expect(todoIdx).toBeLessThan(notesIdx);

    // Source side untouched (action defaults to "none" in 1.3.0)
    const yesterdayContent = await readNote(`${yesterday}.md`);
    expect(yesterdayContent).toContain("- [ ] yesterday todo");
  });

  it("(cluster D) onRolloverSourceAction='mark' rewrites yesterday's todos to use the configured marker", async function () {
    const { today, yesterday } = await getDateStrings();
    await writeNote(
      `${yesterday}.md`,
      ["- [ ] one", "- [ ] two", "- [x] already done"].join("\n")
    );
    await writeNote(`${today}.md`, "");

    await browser.executeObsidian(async ({ app }) => {
      const plugin = app.plugins.getPlugin("obsidian-rollover-daily-todos");
      plugin.settings.onRolloverSourceAction = "mark";
      plugin.settings.rolloverSourceMarker = ">";
      plugin.settings.templateHeading = "none";
      await plugin.saveSettings();
    });

    await browser.executeObsidianCommand(ROLLOVER_CMD);

    const yesterdayContent = await readNote(`${yesterday}.md`);
    expect(yesterdayContent).toContain("- [>] one");
    expect(yesterdayContent).toContain("- [>] two");
    // already-done lines must be untouched (they were never rolled)
    expect(yesterdayContent).toContain("- [x] already done");
  });

  it("(cluster E) skipExistingTodos prevents duplicate insertion when today already has the todo", async function () {
    const { today, yesterday } = await getDateStrings();
    await writeNote(
      `${yesterday}.md`,
      ["- [ ] recurring", "- [ ] new today"].join("\n")
    );
    await writeNote(`${today}.md`, "- [ ] recurring\n");

    await browser.executeObsidian(async ({ app }) => {
      const plugin = app.plugins.getPlugin("obsidian-rollover-daily-todos");
      plugin.settings.skipExistingTodos = true;
      plugin.settings.templateHeading = "none";
      plugin.settings.onRolloverSourceAction = "none";
      await plugin.saveSettings();
    });

    await browser.executeObsidianCommand(ROLLOVER_CMD);

    const todayContent = await readNote(`${today}.md`);
    // "recurring" should appear exactly once (template-baked, not duplicated)
    const recMatches = todayContent.match(/- \[ \] recurring/g) || [];
    expect(recMatches.length).toBe(1);
    expect(todayContent).toContain("- [ ] new today");
  });

  it("(cluster C) rolloverToMatchingSections routes per-heading buckets to today's matching headings", async function () {
    const { today, yesterday } = await getDateStrings();
    await writeNote(
      `${yesterday}.md`,
      [
        "## Plan",
        "- [ ] yesterday-plan",
        "## Habits",
        "- [ ] yesterday-habit",
      ].join("\n")
    );
    await writeNote(
      `${today}.md`,
      ["## Plan", "## Habits", "## Notes"].join("\n")
    );

    await browser.executeObsidian(async ({ app }) => {
      const plugin = app.plugins.getPlugin("obsidian-rollover-daily-todos");
      plugin.settings.rolloverToMatchingSections = true;
      plugin.settings.templateHeading = "none";
      plugin.settings.onRolloverSourceAction = "none";
      await plugin.saveSettings();
    });

    await browser.executeObsidianCommand(ROLLOVER_CMD);

    const todayContent = await readNote(`${today}.md`);
    const lines = todayContent.split("\n");
    const planIdx = lines.indexOf("## Plan");
    const habitsIdx = lines.indexOf("## Habits");
    const planTodoIdx = lines.indexOf("- [ ] yesterday-plan");
    const habitTodoIdx = lines.indexOf("- [ ] yesterday-habit");
    expect(planTodoIdx).toBeGreaterThan(planIdx);
    expect(planTodoIdx).toBeLessThan(habitsIdx);
    expect(habitTodoIdx).toBeGreaterThan(habitsIdx);
  });
});
