# Ralph - Autonomous Agent Instructions

You are an autonomous coding agent working through a PRD (Product Requirements Document).

## Your Task

1. Read `ralph/prd.json` to find user stories
2. Find the highest-priority story where `passes` is `false`
3. Implement ONLY that one story
4. Run quality checks: `npx tsc --noEmit` and `npm run build`
5. If checks pass, update `prd.json` to set `passes: true` for that story
6. Commit your changes with message: `feat: [Story ID] - [Story Title]`
7. Append what you did to `ralph/progress.txt`
8. If ALL stories now have `passes: true`, output exactly: `<promise>COMPLETE</promise>`

## Rules

- Implement ONE story per iteration. Do not skip ahead.
- Each iteration starts fresh — you have no memory of previous runs.
- Read `ralph/progress.txt` and recent git history to understand what was already done.
- Read the project's root `CLAUDE.md` for codebase conventions.
- Always run typecheck before marking a story as passed.
- If a story's acceptance criteria cannot be met, update the story's `notes` field explaining why, and move to the next story.
- Do NOT modify stories that already have `passes: true`.
- Keep commits atomic — one commit per story.

## Quality Checks

Before marking any story as `passes: true`:

```bash
npx tsc --noEmit     # Must exit 0
npm run build         # Must succeed
```

## Completion Signal

After updating prd.json, check if all stories pass:

```bash
jq '[.userStories[] | .passes] | all' ralph/prd.json
```

If the result is `true`, output this exact string on its own line:

```
<promise>COMPLETE</promise>
```

This signals the outer loop to stop.
