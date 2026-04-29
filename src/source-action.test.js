import { expect, test, describe } from "vitest";
import { applySourceAction, resolveSourceAction } from "./source-action";

describe("applySourceAction — none", () => {
  test("returns content untouched when action is none", () => {
    const r = applySourceAction({
      content: "- [ ] one\n- [ ] two\n",
      todos: ["- [ ] one"],
      action: "none",
    });
    expect(r.content).toBe("- [ ] one\n- [ ] two\n");
    expect(r.changed).toBe(false);
  });

  test("returns content untouched when todos list is empty", () => {
    const r = applySourceAction({
      content: "anything",
      todos: [],
      action: "delete",
    });
    expect(r.changed).toBe(false);
  });
});

describe("applySourceAction — delete (legacy deleteOnComplete)", () => {
  test("splices out exact-line matches", () => {
    const r = applySourceAction({
      content: "header\n- [ ] one\n- [ ] two\nfooter",
      todos: ["- [ ] one"],
      action: "delete",
    });
    expect(r.content).toBe("header\n- [ ] two\nfooter");
    expect(r.changed).toBe(true);
  });

  test("removes children that came along as todos", () => {
    const r = applySourceAction({
      content: "- [ ] parent\n    - some note\n    - [ ] sub\nafter",
      todos: ["- [ ] parent", "    - some note", "    - [ ] sub"],
      action: "delete",
    });
    expect(r.content).toBe("after");
  });

  test("does not match lines that differ in whitespace", () => {
    const r = applySourceAction({
      content: "  - [ ] one\n", // leading 2 spaces
      todos: ["- [ ] one"],
      action: "delete",
    });
    expect(r.changed).toBe(false);
  });
});

describe("applySourceAction — mark", () => {
  test("rewrites checkbox content to the marker character", () => {
    const r = applySourceAction({
      content: "header\n- [ ] one\n- [ ] two\nfooter",
      todos: ["- [ ] one", "- [ ] two"],
      action: "mark",
      marker: ">",
    });
    expect(r.content).toBe("header\n- [>] one\n- [>] two\nfooter");
    expect(r.changed).toBe(true);
  });

  test("preserves leading indentation", () => {
    const r = applySourceAction({
      content: "    - [ ] indented",
      todos: ["    - [ ] indented"],
      action: "mark",
      marker: "-",
    });
    expect(r.content).toBe("    - [-] indented");
  });

  test("works with alternate bullet symbols", () => {
    const r = applySourceAction({
      content: "* [ ] one\n+ [ ] two",
      todos: ["* [ ] one", "+ [ ] two"],
      action: "mark",
    });
    expect(r.content).toBe("* [>] one\n+ [>] two");
  });

  test("only transforms checkbox lines — non-checkbox children come through unchanged", () => {
    const r = applySourceAction({
      content: "- [ ] parent\n    - some note\n    - [ ] sub",
      todos: ["- [ ] parent", "    - some note", "    - [ ] sub"],
      action: "mark",
      marker: ">",
    });
    expect(r.content).toBe(
      "- [>] parent\n    - some note\n    - [>] sub"
    );
  });

  test("does not touch lines not in the rolled-todos set", () => {
    const r = applySourceAction({
      content: "- [ ] rolled\n- [ ] not rolled",
      todos: ["- [ ] rolled"],
      action: "mark",
      marker: ">",
    });
    expect(r.content).toBe("- [>] rolled\n- [ ] not rolled");
  });

  test("supports multi-character marker via single-grapheme replacement", () => {
    // current implementation puts the marker string verbatim into [..]; users
    // who need an emoji marker can do so
    const r = applySourceAction({
      content: "- [ ] one",
      todos: ["- [ ] one"],
      action: "mark",
      marker: "✅",
    });
    expect(r.content).toBe("- [✅] one");
  });
});

describe("resolveSourceAction — settings migration", () => {
  test("respects explicit onRolloverSourceAction", () => {
    expect(
      resolveSourceAction({ onRolloverSourceAction: "mark", deleteOnComplete: true })
    ).toBe("mark");
    expect(resolveSourceAction({ onRolloverSourceAction: "none" })).toBe("none");
  });

  test("falls back to legacy deleteOnComplete when new setting missing", () => {
    expect(resolveSourceAction({ deleteOnComplete: true })).toBe("delete");
    expect(resolveSourceAction({ deleteOnComplete: false })).toBe("none");
    expect(resolveSourceAction({})).toBe("none");
  });
});
