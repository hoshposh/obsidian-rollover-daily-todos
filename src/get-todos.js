class TodoParser {
  // Support all unordered list bullet symbols as per spec (https://daringfireball.net/projects/markdown/syntax#list)
  bulletSymbols = ["-", "*", "+"];

  // Default completed status markers
  doneStatusMarkers = ["x", "X", "-"];

  // List of strings that include the Markdown content
  #lines;

  // Boolean that encodes whether nested items should be rolled over
  #withChildren;

  // (#125) When true, completed-todo children (and their descendants) are
  // dropped during the children walk. Non-todo children (text/sub-bullets)
  // are unaffected. Only meaningful when #withChildren is true.
  #skipCompletedChildren;

  // Parse content with segmentation to allow for Unicode grapheme clusters
  #parseIntoChars(content, contentType = "content") {
    // Use Intl.Segmenter to properly split grapheme clusters if available,
    // otherwise fall back to Array.from. The fallback should not trigger in
    // Obsidian since it uses Electron which supports Intl.Segmenter.
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      return Array.from(segmenter.segment(content), (s) => s.segment);
    } else {
      // Array.from() splits surrogate pairs correctly but not complex grapheme clusters
      // (e.g., 👨‍👩‍👧‍👦 would be split incorrectly) and fail to match.
      console.error(
        `Intl.Segmenter not available, falling back to Array.from() for ${contentType}`
      );
      return Array.from(content);
    }
  }

  constructor(lines, withChildren, doneStatusMarkers, skipCompletedChildren) {
    this.#lines = lines;
    this.#withChildren = withChildren;
    this.#skipCompletedChildren = !!skipCompletedChildren;
    if (doneStatusMarkers) {
      this.doneStatusMarkers = this.#parseIntoChars(
        doneStatusMarkers,
        "done status markers"
      );
    }
  }

  // Returns true if the line is a checkbox whose content is a done marker.
  // (Distinct from #isTodo which is true only for *incomplete* todos.)
  #isDoneTodo(s) {
    const match = s.match(/\s*[*+-] \[(.+?)\]/);
    if (!match) return false;
    const contentChars = this.#parseIntoChars(match[1], "checkbox content");
    if (contentChars.length !== 1) return false;
    return contentChars.some((c) => this.doneStatusMarkers.includes(c));
  }

  // Returns true if string s is a todo-item
  #isTodo(s) {
    // Extract the checkbox content
    const match = s.match(/\s*[*+-] \[(.+?)\]/);
    if (!match) return false;

    const checkboxContent = match[1];

    // Parse content with segmentation to allow for Unicode grapheme clusters
    const contentChars = this.#parseIntoChars(
      checkboxContent,
      "checkbox content"
    );

    // Valid checkbox content must be exactly one grapheme cluster
    if (contentChars.length !== 1) {
      return false;
    }

    const singleChar = contentChars[0];

    // Exclude grapheme modifiers that are not valid as standalone content
    const graphemeModifiers = ['\u202E', '\u200B', '\u200C', '\u200D'];
    const hasGraphemeModifier = contentChars.some((char) =>
      graphemeModifiers.includes(char)
    );
    if (hasGraphemeModifier) {
      return false;
    }

    // Check if the checkbox content contains any characters that are in doneStatusMarkers
    const hasDoneMarker = contentChars.some((char) =>
      this.doneStatusMarkers.includes(char)
    );

    // Return true (is a todo) if it does NOT contain any done markers
    return !hasDoneMarker;
  }

  // Returns true if line after line-number `l` is a nested item
  #hasChildren(l) {
    if (l + 1 >= this.#lines.length) {
      return false;
    }
    const indCurr = this.#getIndentation(l);
    const indNext = this.#getIndentation(l + 1);
    if (indNext > indCurr) {
      return true;
    }
    return false;
  }

  // Returns { children, consumed } — children is the list of nested items to
  // include after line `parentLinum`; consumed is the number of source lines
  // actually walked (which can exceed children.length when skipping).
  #getChildren(parentLinum) {
    const children = [];
    let nextLinum = parentLinum + 1;
    while (this.#isChildOf(parentLinum, nextLinum)) {
      const line = this.#lines[nextLinum];
      if (this.#skipCompletedChildren && this.#isDoneTodo(line)) {
        // (#125) drop this completed child *and its descendants* — if a parent
        // task is done, its sub-tasks are implicitly done too
        const completedChildIndent = this.#getIndentation(nextLinum);
        nextLinum++;
        while (
          nextLinum < this.#lines.length &&
          this.#getIndentation(nextLinum) > completedChildIndent
        ) {
          nextLinum++;
        }
        continue;
      }
      children.push(line);
      nextLinum++;
    }
    return { children, consumed: nextLinum - parentLinum - 1 };
  }

  // Returns true if line `linum` has more indentation than line `parentLinum`
  #isChildOf(parentLinum, linum) {
    if (parentLinum >= this.#lines.length || linum >= this.#lines.length) {
      return false;
    }
    return this.#getIndentation(linum) > this.#getIndentation(parentLinum);
  }

  // Returns the number of whitespace-characters at beginning of string at line `l`
  #getIndentation(l) {
    return this.#lines[l].search(/\S/);
  }

  // Returns a list of strings that represents all the todos along with there potential children
  getTodos() {
    let todos = [];
    for (let l = 0; l < this.#lines.length; l++) {
      const line = this.#lines[l];
      if (this.#isTodo(line)) {
        todos.push(line);
        if (this.#withChildren && this.#hasChildren(l)) {
          const { children, consumed } = this.#getChildren(l);
          todos = [...todos, ...children];
          l += consumed;
        }
      }
    }
    return todos;
  }
}

// Utility-function that acts as a thin wrapper around `TodoParser`
export const getTodos = ({
  lines,
  withChildren = false,
  doneStatusMarkers = null,
  skipCompletedChildren = false,
}) => {
  const todoParser = new TodoParser(
    lines,
    withChildren,
    doneStatusMarkers,
    skipCompletedChildren
  );
  return todoParser.getTodos();
};
