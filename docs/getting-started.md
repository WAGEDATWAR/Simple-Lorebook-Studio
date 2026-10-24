# Getting started

Lorebook Studio is a local-first editor for lorebooks used in LLM roleplay frontends. Everything runs in your browser: there are no accounts, no analytics, and no uploads.

## Create your first lorebook

1. **Name your lorebook.** The title field at the top of the window names the active lorebook. Use the sidebar dropdown to switch between lorebooks or add a new one with the `+` button.
2. **Add entries.** Choose **New entry** or **From template**, then fill in the title and content. Content is the text injected when the entry activates.
3. **Add trigger keys.** Type keys as chips: press `Enter` or `,` to add one, paste a comma- or newline-separated list, or write a regex key as `/pattern/i`. Always-on entries skip key matching entirely.
4. **Organize and search.** Add tags to entries and lorebooks, then filter the list by tag or by status (enabled, disabled, always-on, missing keys). Search highlights matches and shows which fields matched.
5. **Check for problems.** Open **Issues** to find empty content, duplicate or colliding keys, invalid regex, missing keys, unreachable entries, and insertion-order collisions. Click an issue to jump to the entry.

## Save and back up

- Changes save to your browser automatically. The header shows **Saved**, **Saving**, or **Unsaved**.
- Your project is stored in IndexedDB when available, with a localStorage fallback. Existing localStorage projects migrate automatically on first run.
- Export a **project backup** regularly from the Export dialog. If the browser supports the File System Access API, use **Save** to write a project file in place.
- If a save fails (for example, when storage is full), a banner appears with **Export backup** and **Retry save** actions.

## Import and export

- **Import** accepts Lorebook Studio projects, SillyTavern World Info v2, Chub lorebooks, and character books. The import preview shows a diff and lets you replace, append, or merge by title.
- **Export** produces a full project backup or a single active lorebook as native JSON, SillyTavern World Info v2, Chub, or a standalone character book.
- Unknown fields from imported files are preserved and restored when you export back to that format.

## Tokens

- Open **About** -> **Token settings** to pick the tokenizer that matches your model (cl100k_base for GPT-3.5 Turbo/GPT-4, o200k_base for GPT-4o/GPT-4.1/o1/o3) and the context window used for budget warnings.
- The overview reports the active tokenizer, context-window usage, and budget usage; the simulation reports injected tokens as a percentage of the context window.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `/` | Focus search |
| `Ctrl/Cmd+Shift+F` | Search all lorebooks |
| `Alt+N` | New entry |
| `Ctrl/Cmd+K` | Command palette |
| `Ctrl/Cmd+S` | Save project |
| `Ctrl/Cmd+O` | Open project file (when supported) |
| `Ctrl/Cmd+Shift+S` | Save project file (when supported) |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` | Redo |
| `ArrowUp`/`ArrowDown`/`Home`/`End` | Navigate the entry list |
| `Alt+ArrowUp`/`Alt+ArrowDown` | Reorder an entry in manual order |

## Privacy

Lorebook Studio never sends your data anywhere. Projects live in your browser and are only shared when you explicitly export or import a file.
