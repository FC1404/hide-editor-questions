# Hide Editor Questions

The answer view hides the question and arrow of a tagged flashcard in the RemNote editor. It supports single-line and multiline forward and backward cards. For cards set to both directions, the answer view follows the forward direction.

## Usage

1. Apply a configured tag to the line that contains the flashcard arrow.
2. Use the eye icon in the document header to show or hide questions. You can also run **Flashcards: Toggle answer view** from the command search or the **⋯** document menu.
3. Open the tag editor using the tag icon, or run **Flashcards: Edit tags for hiding questions**. Use **Add tag** to add a row, select a row to enable **Remove tag**, and click **Save** to apply your changes. Use the full path for nested tags, such as `Study > Exam`.

A card qualifies when it has at least one configured tag. On first use the tag editor shows one empty row. Enter an existing RemNote tag and save it to start using question hiding. An empty tag list keeps all questions visible.

Starting with version 0.2.13, the plugin ID is `hide-editor-questions`. RemNote treats it as a separate plugin. Copy any custom tag names from the previous plugin before disabling it, then enter them in the new tag editor.

When the answer view opens a collapsed multiline forward card, turning the view off restores the original fold state. The plugin works in the editor. Flashcard content and review scheduling stay the same.

## Permissions and privacy

The plugin runs in RemNote's sandbox and requests `All / ReadCreateModify`. It reads configured tags, matching cards, and their Rem hierarchy to generate editor CSS. It uses `setIsCollapsed` to update the fold state of tagged multiline forward cards. It does not create, move, or delete notes.

RemNote syncs configured tag names through its plugin storage. The answer-view toggle is stored for the current session. The plugin code does not transmit notes, Rem IDs, or tag names to third-party services and does not include analytics.

## Build and submit

1. Set `author` and `repoUrl` in `manifest.json` to your name and this plugin's public GitHub repository. Keep `unlisted: true` for an unlisted release.
2. Run `npm install` or `pnpm install --frozen-lockfile`, then run `npm run build`. The upload files are generated in `dist`.
3. To try the build locally, run `node serve.mjs`. In RemNote, go to **Settings → Plugins → Build → Develop from localhost** and enter `http://127.0.0.1:8080`.
4. Publish the source code and updated manifest in the public repository. Package the five files in `dist` directly at the root of the upload ZIP.

   ```powershell
   Compress-Archive -LiteralPath dist/index.html,dist/index.js,dist/index-sandbox.js,dist/manifest.json,dist/README.md -DestinationPath RemNote-Upload.zip -Force
   ```

5. Upload the ZIP in **Settings → Plugins → Build → Upload plugin**. After review, open the unlisted installation page at `https://www.remnote.com/plugins/hide-editor-questions`.

[Submission guidelines](https://plugins.remnote.com/advanced/submitting_plugins) · [Unlisted plugins](https://plugins.remnote.com/advanced/unlisted_plugins)

Use English for new user-facing plugin text.
