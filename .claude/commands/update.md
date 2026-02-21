Review the full conversation and current project state, then update all artifacts that may be stale.

Steps:

1. **Check what changed.** Read `git log --oneline` since the last update (or scan the conversation) to identify what's new or modified.

2. **Update reports.** For each report in `reports/`, check if its underlying data has changed. If so, regenerate the HTML with current data. Read `reports/README.md` for the manifest.

3. **Update the hub.** Ensure `reports/hub.html` reflects all reports in the manifest — both timeline entries and mind map nodes. Add new nodes, remove deleted ones, update relationships.

4. **Update the journal README.** Ensure `journal/README.md` table is complete and accurate.

5. **Update CLAUDE.md.** If new operational knowledge was discovered, add it. Keep it short per existing rules.

6. **Cross-reference consistency.** Check that:
   - Brand guidelines in `brand/` still match what's in the CSS (`src/styles/global.css`)
   - Report data matches current site state (e.g., content gaps report reflects actual pages)
   - No broken internal links between reports

7. **Commit** all updates with message: "Update context — [brief description of what changed]"

If the user provides specific context about what changed, focus on that. Otherwise, do a full sweep.

$ARGUMENTS
