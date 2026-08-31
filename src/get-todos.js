class TodoParser {
  // Support all unordered list bullet symbols as per spec (https://daringfireball.net/projects/markdown/syntax#list)
  bulletSymbols = ["-", "*", "+"];

  // Default completed status markers
  doneStatusMarkers = ["x", "X", "-"];

  // List of strings that include the Markdown content
  #lines;

  // Boolean that encodes whether nested items should be rolled over
  #withChildren;

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

  constructor(lines, withChildren, doneStatusMarkers) {
    this.#lines = lines;
    this.#withChildren = withChildren;
    if (doneStatusMarkers) {
      this.doneStatusMarkers = this.#parseIntoChars(
        doneStatusMarkers,
        "done status markers"
      );
    }
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

  // Returns a list of strings that are the nested items after line `parentLinum`
  #getChildren(parentLinum) {
    const children = [];
    let nextLinum = parentLinum + 1;
    while (this.#isChildOf(parentLinum, nextLinum)) {
      children.push(this.#lines[nextLinum]);
      nextLinum++;
    }
    return children;
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
          const cs = this.#getChildren(l);
          todos = [...todos, ...cs];
          l += cs.length;
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
}) => {
  const todoParser = new TodoParser(lines, withChildren, doneStatusMarkers);
  return todoParser.getTodos();
};

// Returns the heading level (1-6) for a line like "## Foo", or null if not a heading
function getHeadingLevel(line) {
  const match = line.match(/^(#{1,6}) /);
  return match ? match[1].length : null;
}

// Returns sections from `lines` that have incomplete todos, grouped by direct parent heading.
// Each section is { heading: string|null, incompleteTodos: string[] }.
export const getSections = ({
  lines,
  withChildren = false,
  doneStatusMarkers = null,
}) => {
  const sections = [];
  let currentHeading = null;
  let sectionLines = [];

  const finalizeSection = () => {
    const incompleteTodos = getTodos({ lines: sectionLines, withChildren, doneStatusMarkers });
    if (incompleteTodos.length > 0) {
      sections.push({ heading: currentHeading, incompleteTodos });
    }
  };

  for (const line of lines) {
    if (getHeadingLevel(line) !== null) {
      finalizeSection();
      currentHeading = line;
      sectionLines = [];
    } else {
      sectionLines.push(line);
    }
  }
  finalizeSection();

  return sections;
};

// Removes heading lines whose entire section (direct content + sub-sections recursively)
// contains no non-blank content after incomplete todos have been removed.
export const removeEmptyHeadings = (lines) => {
  const [result] = processSection(lines, 0, 0);
  return result;
};

// Returns [filteredLines, nextIndex]. Processes lines starting at startIdx,
// stopping when a heading at level <= parentLevel is encountered.
function processSection(lines, startIdx, parentLevel) {
  const result = [];
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    const level = getHeadingLevel(line);

    if (level !== null && level <= parentLevel) {
      break;
    }

    if (level !== null) {
      const [sectionContent, nextI] = processSection(lines, i + 1, level);
      if (sectionContent.some((l) => l.trim() !== "")) {
        result.push(line);
        result.push(...sectionContent);
      }
      i = nextI;
    } else {
      result.push(line);
      i++;
    }
  }

  return [result, i];
}

// Inserts textToInsert into noteContent right before the next heading at the same
// or higher level as targetHeading (fewer or equal # signs). Falls back to appending
// at end of file if targetHeading is not found. leadingNewLine adds a blank line before
// the inserted text.
export const insertUnderHeading = (
  noteContent,
  targetHeading,
  textToInsert,
  leadingNewLine = false
) => {
  const escapedHeading = targetHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingLineRegex = new RegExp(`^${escapedHeading}$`, "m");
  const headingMatch = headingLineRegex.exec(noteContent);

  if (!headingMatch) {
    return noteContent + (leadingNewLine ? "\n" : "") + textToInsert;
  }

  const level = getHeadingLevel(targetHeading);
  const searchStart = headingMatch.index + headingMatch[0].length;

  const nextHeadingRegex = new RegExp(`\\n#{1,${level}} `, "g");
  nextHeadingRegex.lastIndex = searchStart;
  const nextMatch = nextHeadingRegex.exec(noteContent);

  const insertionPoint = nextMatch !== null ? nextMatch.index : noteContent.length;
  const prefix = leadingNewLine ? "\n" : "";

  return (
    noteContent.slice(0, insertionPoint) +
    prefix +
    textToInsert +
    "\n" +
    noteContent.slice(insertionPoint)
  );
};
