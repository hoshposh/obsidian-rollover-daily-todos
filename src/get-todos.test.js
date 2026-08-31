import { expect, test } from "vitest";
import { getTodos, getSections, removeEmptyHeadings, insertUnderHeading } from "./get-todos";

test("single todo element should return itself", () => {
  // GIVEN
  const lines = ["- [ ] tada"];

  // WHEN
  const result = getTodos({ lines });

  // THEN
  const todos = ["- [ ] tada"];
  expect(result).toStrictEqual(todos);
});

test("single incomplete element should return itself", () => {
  // GIVEN
  const lines = ["- [/] tada"];

  // WHEN
  const result = getTodos({ lines });

  // THEN
  const todos = ["- [/] tada"];
  expect(result).toStrictEqual(todos);
});

test("single done todo element should not return itself", () => {
  // GIVEN
  const lines = ["- [x] tada"];

  // WHEN
  const result = getTodos({ lines });

  // THEN
  const todos = [];
  expect(result).toStrictEqual(todos);
});

test("single canceled todo element should not return itself", () => {
  // GIVEN
  const lines = ["- [-] tada"];

  // WHEN
  const result = getTodos({ lines });

  // THEN
  const todos = [];
  expect(result).toStrictEqual(todos);
});

test("get todos with children", function () {
  // GIVEN
  const lines = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines: lines, withChildren: true });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos (with alternate symbols) with children", function () {
  // GIVEN
  const lines = [
    "+ [ ] TODO",
    "    + [ ] Next",
    "    * some stuff",
    "* [ ] Another one",
    "    - [ ] More children",
    "    + another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines: lines, withChildren: true });

  // THEN
  const result = [
    "+ [ ] TODO",
    "    + [ ] Next",
    "    * some stuff",
    "* [ ] Another one",
    "    - [ ] More children",
    "    + another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos (with alternate symbols and partially checked todos) with children", function () {
  // GIVEN
  const lines = [
    "+ [x] Completed TODO",
    "    + [ ] Next",
    "    * some stuff",
    "* [ ] Another one",
    "    - [x] Completed child",
    "    + another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines: lines, withChildren: true });

  // THEN
  const result = [
    "    + [ ] Next",
    "* [ ] Another one",
    "    - [x] Completed child",
    "    + another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos (with custom ✅ done status and 🟣 not-done child status) with children", function () {
  // GIVEN
  const lines = [
    "+ [✅] Completed TODO",
    "    + [🟣] Next",
    "    * some stuff",
    "* [🟣] Another one",
    "    - [✅] Completed child",
    "    + another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({
    lines: lines,
    withChildren: true,
    doneStatusMarkers: "✅",
  });

  // THEN
  const result = [
    "    + [🟣] Next",
    "* [🟣] Another one",
    "    - [✅] Completed child",
    "    + another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos (with default dash prefix and finished todos) with children", function () {
  // GIVEN
  const lines = [
    "- [x] Completed TODO",
    "    - [ ] Next",
    "    * some stuff",
    "- [ ] Another one",
    "    - [x] Completed child",
    "    + another child",
    "* this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines: lines, withChildren: true });

  // THEN
  const result = [
    "    - [ ] Next",
    "- [ ] Another one",
    "    - [x] Completed child",
    "    + another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos without children", () => {
  // GIVEN
  const lines = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [ ] Next",
    "- [ ] Another one",
    "    - [ ] More children",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos without children (with 🟣 not-done child status)", () => {
  // GIVEN
  const lines = [
    "- [ ] TODO",
    "    - [🟣] Next",
    "    - some stuff",
    "- [🟣] Another one",
    "    - [ ] More children",
    "    - another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [🟣] Next",
    "- [🟣] Another one",
    "    - [ ] More children",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos with correct alternate checkbox children", function () {
  // GIVEN
  const lines = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - [x] Completed task",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] Another child",
    "    - [/] More children",
    "    - another child",
    "- this isn't copied",
  ];

  // WHEN
  const todos = getTodos({ lines: lines, withChildren: true });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - [x] Completed task",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] Another child",
    "    - [/] More children",
    "    - another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos with children doesn't fail if child at end of list", () => {
  // GIVEN
  const lines = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];

  // WHEN
  const todos = getTodos({ lines, withChildren: true });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos with nested children also adds nested children", () => {
  // GIVEN
  const lines = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "        - some stuff",
    "        - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];

  // WHEN
  const todos = getTodos({ lines, withChildren: true });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "        - some stuff",
    "        - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos doesn't add intermediate other elements", () => {
  // GIVEN
  const lines = [
    "# Some title",
    "",
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "",
    "## Some title",
    "",
    "Some text",
    "...that continues here",
    "",
    "- Here is a bullet item",
    "- Here is another bullet item",
    "1. Here is a numbered list item",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];

  // WHEN
  const todos = getTodos({ lines, withChildren: true });

  // THEN
  const result = [
    "- [ ] TODO",
    "    - [ ] Next",
    "    - some stuff",
    "- [ ] Another one",
    "    - [ ] More children",
    "    - another child",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos supports custom done status markers", () => {
  // GIVEN
  const lines = [
    "- [ ] Incomplete task",
    "- [x] Completed task (x)",
    "- [X] Completed task (X)",
    "- [-] Completed task (-)",
    "- [C] Task with custom status (C)",
    "- [?] Task with custom status (?)",
  ];

  // WHEN - only consider 'C' and '?' as done
  const todos = getTodos({ lines, doneStatusMarkers: "C?" });

  // THEN - x, X, and - should be considered incomplete now
  const result = [
    "- [ ] Incomplete task",
    "- [x] Completed task (x)",
    "- [X] Completed task (X)",
    "- [-] Completed task (-)",
  ];
  expect(todos).toStrictEqual(result);
});

test("get todos supports custom status marker edge cases (exclusion)", () => {
  // GIVEN
  const lines = [
    "- [ ] Normal task",
    // Emojis and symbols
    "- [✅] Checkmark emoji",
    "- [❌] Cross emoji",
    "- [✔️] Heavy checkmark",
    "- [✓] Checkmark symbol",
    "- [✗] Ballot X",
    "- [👍] Thumbs up",
    // Control and non-printable characters
    "- [\u0000] Null",
    "- [\u0007] Bell",
    "- [\u0008] Backspace",
    "- [\u001B] Escape",
    // Combining characters
    "- [a\u0300] Letter with accent",
    "- [e\u0301] Letter with acute",
    // Regex special characters
    "- [.] Dot",
    "- [*] Star",
    "- [+] Plus",
    "- [?] Question",
    "- [(] Open paren",
    "- [)] Close paren",
    "- [[] Open bracket",
    "- []] Close bracket",
    "- [{] Open brace",
    "- [}] Close brace",
    "- [^] Caret",
    "- [$] Dollar",
    "- [|] Pipe",
    "- [\\] Backslash",
    "- [/] Forward slash",
    // Simple accented characters (should be valid)
    "- [à] Simple accented character",
    "- [é] Simple accented character 2",
  ];

  // WHEN - using all types of characters as done markers
  const todos = getTodos({
    lines,
    doneStatusMarkers:
      "✅❌✔️✓✗👍\u0000\u0007\u0008\u001B\u202Ea\u0300e\u0301.*+?()[]{}\\^$|/àé",
  });

  // THEN - only the normal task should be returned
  const result = ["- [ ] Normal task"];
  expect(todos).toStrictEqual(result);
});

test("get todos supports custom status marker edge cases (inclusion)", () => {
  // GIVEN
  const lines = [
    "- [ ] Normal task",
    // Emojis and symbols
    "- [✅] Checkmark emoji",
    "- [❌] Cross emoji",
    "- [✔️] Heavy checkmark",
    "- [✓] Checkmark symbol",
    "- [✗] Ballot X",
    "- [👍] Thumbs up",
    // Control and non-printable characters
    "- [\u0000] Null",
    "- [\u0007] Bell",
    "- [\u0008] Backspace",
    "- [\u001B] Escape",
    // Combining characters
    "- [a\u0300] Letter with accent",
    "- [e\u0301] Letter with acute",
    // Regex special characters
    "- [.] Dot",
    "- [*] Star",
    "- [+] Plus",
    "- [?] Question",
    "- [(] Open paren",
    "- [)] Close paren",
    "- [[] Open bracket",
    "- []] Close bracket",
    "- [{] Open brace",
    "- [}] Close brace",
    "- [^] Caret",
    "- [$] Dollar",
    "- [|] Pipe",
    "- [\\] Backslash",
    "- [/] Forward slash",
    // Simple accented characters (should be valid)
    "- [à] Simple accented character",
    "- [é] Simple accented character 2",
  ];

  // WHEN - only consider 'C' as done
  const todos = getTodos({ lines, doneStatusMarkers: "C" });

  // THEN - only the normal task should be returned
  const result = [
    "- [ ] Normal task",
    // Emojis and symbols
    "- [✅] Checkmark emoji",
    "- [❌] Cross emoji",
    "- [✔️] Heavy checkmark",
    "- [✓] Checkmark symbol",
    "- [✗] Ballot X",
    "- [👍] Thumbs up",
    // Control and non-printable characters
    "- [\u0000] Null",
    "- [\u0007] Bell",
    "- [\u0008] Backspace",
    "- [\u001B] Escape",
    // Combining characters
    "- [a\u0300] Letter with accent",
    "- [e\u0301] Letter with acute",
    // Regex special characters
    "- [.] Dot",
    "- [*] Star",
    "- [+] Plus",
    "- [?] Question",
    "- [(] Open paren",
    "- [)] Close paren",
    "- [[] Open bracket",
    "- []] Close bracket",
    "- [{] Open brace",
    "- [}] Close brace",
    "- [^] Caret",
    "- [$] Dollar",
    "- [|] Pipe",
    "- [\\] Backslash",
    "- [/] Forward slash",
    // Simple accented characters (should be valid)
    "- [à] Simple accented character",
    "- [é] Simple accented character 2",
  ];
  expect(todos).toStrictEqual(result);
});

test("should not match malformed todos", () => {
  const lines = [
    "- [ ] valid todo",
    "- [x] done", // done, should NOT match
    // Malformed, should not match
    "- [] empty",
    "- [  ] multiple spaces",
    "- [✅\u200B\u0300] multiple special",
    "- [.*+?()] multiple regexp",
    "- [a\u0300\u200B] multimple combining",
    // Grapheme modifiers, not valid on their own
    "- [\u202E] RTL override",
    "- [\u200B] Zero-width space",
    "- [\u200C] Zero-width non-joiner",
    "- [\u200D] Zero-width joiner",
  ];
  const todos = getTodos({ lines });
  expect(todos).toStrictEqual(["- [ ] valid todo"]);
});

// ─── getSections ────────────────────────────────────────────────────────────

test("getSections returns empty array when no todos exist", () => {
  const lines = ["## Notes", "", "some text", "- not a todo"];
  expect(getSections({ lines })).toStrictEqual([]);
});

test("getSections groups incomplete todos under their direct parent heading", () => {
  const lines = [
    "## Notes",
    "",
    "### Today's intent",
    "- [ ] task1",
    "",
    "#### Personal Projects",
    "",
    "- [x] Setup SSO",
    "- [ ] Create browser extension",
    "",
    "#### IRAP",
    "",
    "- [x] Review AI controls",
    "- [ ] Organize call",
  ];

  const sections = getSections({ lines, doneStatusMarkers: "xX-" });

  expect(sections).toStrictEqual([
    { heading: "### Today's intent", incompleteTodos: ["- [ ] task1"] },
    { heading: "#### Personal Projects", incompleteTodos: ["- [ ] Create browser extension"] },
    { heading: "#### IRAP", incompleteTodos: ["- [ ] Organize call"] },
  ]);
});

test("getSections excludes sections with only completed todos", () => {
  const lines = [
    "#### All done",
    "- [x] done1",
    "- [x] done2",
    "#### Has todos",
    "- [ ] still open",
  ];

  const sections = getSections({ lines, doneStatusMarkers: "xX-" });

  expect(sections).toStrictEqual([
    { heading: "#### Has todos", incompleteTodos: ["- [ ] still open"] },
  ]);
});

test("getSections puts todos before any heading into null heading section", () => {
  const lines = [
    "- [ ] floating todo",
    "- [x] done",
    "## Notes",
    "- [ ] under heading",
  ];

  const sections = getSections({ lines, doneStatusMarkers: "xX-" });

  expect(sections).toStrictEqual([
    { heading: null, incompleteTodos: ["- [ ] floating todo"] },
    { heading: "## Notes", incompleteTodos: ["- [ ] under heading"] },
  ]);
});

test("getSections respects withChildren option", () => {
  const lines = [
    "#### IRAP",
    "- [ ] Setup meeting - @person",
    "    - [i] Sent notes",
    "- [ ] Organize call",
  ];

  const sections = getSections({ lines, withChildren: true, doneStatusMarkers: "xX" });

  expect(sections).toStrictEqual([
    {
      heading: "#### IRAP",
      incompleteTodos: [
        "- [ ] Setup meeting - @person",
        "    - [i] Sent notes",
        "- [ ] Organize call",
      ],
    },
  ]);
});

test("getSections respects custom doneStatusMarkers", () => {
  const lines = [
    "#### Section",
    "- [b] blocked task",
    "- [ ] open task",
    "- [x] done task",
  ];

  const sections = getSections({ lines, doneStatusMarkers: "xXb" });

  expect(sections).toStrictEqual([
    { heading: "#### Section", incompleteTodos: ["- [ ] open task"] },
  ]);
});

test("getSections handles multiple headings at same level independently", () => {
  const lines = [
    "#### Section A",
    "- [ ] todo A",
    "#### Section B",
    "- [ ] todo B",
  ];

  const sections = getSections({ lines });

  expect(sections).toStrictEqual([
    { heading: "#### Section A", incompleteTodos: ["- [ ] todo A"] },
    { heading: "#### Section B", incompleteTodos: ["- [ ] todo B"] },
  ]);
});

// ─── removeEmptyHeadings ────────────────────────────────────────────────────

test("removeEmptyHeadings returns lines unchanged when no headings present", () => {
  const lines = ["- [x] done", "some text"];
  expect(removeEmptyHeadings(lines)).toStrictEqual(lines);
});

test("removeEmptyHeadings removes heading whose section is only blank lines", () => {
  const lines = [
    "### Empty section",
    "",
    "",
    "### Non-empty section",
    "- [x] done",
  ];
  expect(removeEmptyHeadings(lines)).toStrictEqual([
    "### Non-empty section",
    "- [x] done",
  ]);
});

test("removeEmptyHeadings keeps heading that has content directly under it", () => {
  const lines = ["### Section", "- [x] done"];
  expect(removeEmptyHeadings(lines)).toStrictEqual(["### Section", "- [x] done"]);
});

test("removeEmptyHeadings removes parent heading when all sub-sections are empty", () => {
  const lines = [
    "### Parent",
    "#### Child 1",
    "",
    "#### Child 2",
    "",
    "## Unrelated",
    "- [x] content",
  ];
  expect(removeEmptyHeadings(lines)).toStrictEqual(["## Unrelated", "- [x] content"]);
});

test("removeEmptyHeadings keeps parent heading when a sub-section has content", () => {
  const lines = [
    "### Parent",
    "#### Child 1",
    "- [x] done",
    "#### Child 2",
    "",
  ];
  expect(removeEmptyHeadings(lines)).toStrictEqual([
    "### Parent",
    "#### Child 1",
    "- [x] done",
  ]);
});

test("removeEmptyHeadings keeps parent heading when it has direct non-todo content", () => {
  const lines = [
    "### Parent",
    "some paragraph text",
    "#### Child",
    "",
  ];
  expect(removeEmptyHeadings(lines)).toStrictEqual([
    "### Parent",
    "some paragraph text",
  ]);
});

// ─── insertUnderHeading ─────────────────────────────────────────────────────

test("insertUnderHeading inserts text right after heading when section is empty", () => {
  const content = "### Today's intent\n\n### Other section\n";
  const result = insertUnderHeading(content, "### Today's intent", "- [ ] new todo");
  expect(result).toBe("### Today's intent\n- [ ] new todo\n\n### Other section\n");
});

test("insertUnderHeading appends after existing section content", () => {
  const content = "### Today's intent\n- [ ] existing\n\n### Other section\n";
  const result = insertUnderHeading(content, "### Today's intent", "- [ ] new todo");
  expect(result).toBe("### Today's intent\n- [ ] existing\n- [ ] new todo\n\n### Other section\n");
});

test("insertUnderHeading inserts at end of section including sub-headings", () => {
  const content = "### Today's intent\n\n#### Sub\n- [x] done\n\n### Other\n";
  const result = insertUnderHeading(content, "### Today's intent", "#### New sub\n- [ ] todo");
  expect(result).toBe("### Today's intent\n\n#### Sub\n- [x] done\n#### New sub\n- [ ] todo\n\n### Other\n");
});

test("insertUnderHeading falls back to end of file when heading not found", () => {
  const content = "## Notes\n\nsome content\n";
  const result = insertUnderHeading(content, "### Missing heading", "- [ ] todo");
  expect(result).toBe("## Notes\n\nsome content\n- [ ] todo");
});

test("insertUnderHeading with leadingNewLine adds blank line before inserted text", () => {
  const content = "### Today's intent\n";
  const result = insertUnderHeading(content, "### Today's intent", "- [ ] todo", true);
  expect(result).toBe("### Today's intent\n\n- [ ] todo\n");
});
