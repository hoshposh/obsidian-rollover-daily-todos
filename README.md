# Rollover Daily Todos

[![Build](https://github.com/lumoe/obsidian-rollover-daily-todos/actions/workflows/ci.yml/badge.svg)](https://github.com/lumoe/obsidian-rollover-daily-todos/actions/workflows/ci.yml)

This Obsidian plugin will rollover any incomplete todo items from the previous daily note (could be yesterday, or a week ago) to today. This is triggered automatically when a new daily note is created via the internal `Daily notes` plugin, or the `Periodic Notes` plugin., It can also be run as a command from the Command Palette.

![A demo of the plugin working](./demo.gif)

## Usage

### 1. New Daily Note

Just create a new daily note using the `Daily notes` or `Periodic Notes` plugin. The previous day's incomplete todos will be rolled over to today's daily note.

**Note:** Automatic rollover can cause conflicts with other plugins, particularly the Templater plugin. If you're using Templater for your daily notes, it's recommended that you disable automatic rollover in the plugin's settings and instead trigger it manually after creation.

### 2. Command: Manual Rollover Todos Now

You can also open your command palette (CMD+P on macOS) and start typing `roll` to find this command. No matter where you are in Obsidian, the previous day's todos will get rolled forward. There is also a command called `Undo last rollover` which can be run within 2 minutes of a rollover occurring. Both commands are potentially destructive, and the default text element undo command (CMD+Z on macOS) didn't work. Currently only 1 undo is available for use at the moment.

Note that if you create a daily note in the future, and you try to run this command, todos will not be rolled into a future date. They will always be rolled to today's note (if it doesn't exist, nothing will happen), from the chronologically closest (in the past) daily note.

## Requirements

- [ ] You must have either:
  1. `Daily notes` plugin installed _or_
  2. `Periodic Notes` plugin installed AND the **Daily Notes** setting toggled on
- [ ] A Note folder set in one of these plugins. Inside it you must have:
  1. 2 or more notes
  2. All notes must be named in the format you use for daily notes (for example `2021-08-29` for `YYYY-MM-DD` )

## Settings

### 1. Disable automatic rollover

If you prefer to trigger the rollover of your todos manually, you can use this setting to prevent the plugin from rolling them over when a new note is created.

### 2. Template Heading

If you chose a template file to use for new daily notes in `Daily notes > Settings` or `Periodic Notes > Settings`, you will be able to choose a heading for incomplete notes to roll into. Note that incomplete todos are taken from the entire file, regardless of what heading they are under. And they are all rolled into today's daily note, right under the heading of choice.

If you leave this field as blank, or select `None`, then incomplete todos will be rolled onto the end of today's note (for new notes with no template, the end is the beginning of the note).

### 3. Delete todos from previous day

By default, this plugin will actually make a copy of incomplete todos. So if you forgot to wash your dog yesterday, and didn't check it off, then you will have an incomplete checkmark on yesterday's daily note, and a new incomplete checkmark will be rolled into today's daily note. If you use the `Undo last rollover` command, deleted todos will be restored (remember, the `time limit on this is 2 minutes`).

Toggling this setting on will remove incomplete todos from the previous daily note once today's daily note has a copy of them.

### 4. Remove empty todos in rollover

By default, this plugin will roll over anything that has a checkbox, whether it has content or not. Toggling this setting on will ignore empty todos. If you have **#3** from above toggled on, it will also delete empty todos.

### 5. Roll over children of todos

By default, only the actual todos are rolled over. If you add nested Markdown elements beneath your todos, these are not rolled over but stay in place. Toggling this setting on allows for also migrating the nested elements, including ones that are completed.

### 6. Done status markers

By default, the plugin considers checkboxes containing 'x', 'X', or '-' as completed tasks that won't be rolled over. You can customize this by adding any characters that should be considered "done" markers. For example, adding '?+>' would also treat checkboxes like '[?]', '[+]', and '[>]' as completed tasks. This is useful for users of custom status markers like the [Obsidian Tasks](https://publish.obsidian.md/tasks/Introduction) plugin.

The plugin supports Unicode characters, including complex emoji and grapheme clusters, in checkbox content. This means you can use emojis or special Unicode characters as status markers and they will be handled correctly.

## Compatibility

Tested against Obsidian **1.12.x** (latest stable, 2026-04). `minAppVersion` in `manifest.json` is `1.4.0`. Mobile (iOS/Android) is supported. Periodic Notes 0.x and 1.0+ (calendar-set rewrite) are both detected and read correctly.

## Known issues

### Templater conflict (auto-rollover fires before template is applied)

If your daily-notes template uses [Templater](https://github.com/SilentVoid13/Templater), automatic rollover may fire on file-create *before* Templater has finished processing the template. Symptom: rolled-over todos appear briefly then vanish, or the new note ends up with template placeholders intact and no todos.

**Recommended fix**: invoke the rollover from within your Templater template instead of relying on the file-create hook. Disable "Automatic rollover on daily note open" in this plugin's settings, then add to your daily-notes template:

```js
<%* await app.commands.executeCommandById("obsidian-rollover-daily-todos:obsidian-rollover-daily-todos-rollover") %>
```

Issues #155, #144, #89, #168 are all instances of this conflict.

### Multi-device sync race

If you sync via Obsidian Sync, LiveSync, or `obsidian-git`, the source (yesterday's) note may not yet be synchronised when a new daily note is created on a second device. Symptom: rollover runs but yesterday's todos are missing because that file's not-yet-synced version is empty. Disable automatic rollover and run manually after sync settles. (Issue #140.)

### Tabs vs spaces in indentation (deletion path only)

The `deleteOnComplete` (delete) source action does an *exact-string* match when removing rolled todos from yesterday's note. If your indentation differs even by one whitespace character, the line will not be deleted. Use the new `mark` source action (default in 1.3.0) to avoid this footgun, or normalise your indentation before relying on `delete`.

## Behaviour notes

1. The parser regex (anchored to start of line in 1.3.0) is `/^\s*[-*+] \[[^xX-]\]/` — bullet, space, brackets with non-done content. Customise the "done" set via the **Done status markers** setting (any single grapheme cluster is supported, including emoji).

2. If you trigger `Rollover Todos Now` too quickly after editing yesterday's note, Obsidian may not have flushed the file yet. Run `Undo last rollover` (which now persists across restart) and retry after a second.

## Installation

This plugin can be installed within the `Third-party Plugins` tab within Obsidian
