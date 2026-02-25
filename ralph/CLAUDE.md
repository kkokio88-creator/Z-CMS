# Ralph — Autonomous Agent Instructions

You are an autonomous coding agent working through a PRD (Product Requirements Document).
Each iteration, you implement ONE user story. You have NO memory of previous runs.

## Startup Sequence

1. Read the project's root `CLAUDE.md` for codebase conventions
2. Read `ralph/progress.txt` to see what was already done
3. Read `ralph/prd.json` to find user stories
4. Check recent git log: `git log --oneline -10`
5. Find the highest-priority story where `passes` is `false`

## Implementation Flow

For the target story:

1. **Read acceptance criteria** carefully — they are your specification
2. **Read the `notes` field** — it contains file paths, type names, and implementation hints
3. **Read relevant source files** before making changes
4. **Implement** the story following existing codebase patterns
5. **Run quality checks** (see below)
6. **Update prd.json** — set `passes: true` and add to `notes` what you did
7. **Commit** with message: `feat: [Story ID] - [Story Title]`
8. **Append** a summary to `ralph/progress.txt`
9. **Check completion** (see below)

## Rules

- Implement ONE story per iteration. Do not skip ahead.
- Follow existing code patterns — read before writing.
- Do NOT modify stories that already have `passes: true`.
- If a story cannot be completed, update its `notes` explaining why and move to next.
- Keep commits atomic — one commit per story.
- Use the project's existing imports, types, and patterns.

## Quality Checks

Before marking any story as `passes: true`, both must pass:

```bash
npx tsc --noEmit     # Must exit 0
npm run build         # Must succeed
```

If typecheck fails, fix the errors and re-check. Do NOT mark as passed until clean.

## Completion Signal

After updating prd.json, check if ALL stories pass:

```bash
jq '[.userStories[] | .passes] | all' ralph/prd.json
```

If the result is `true`, output this exact string on its own line:

```
<promise>COMPLETE</promise>
```

This signals the outer loop to stop. Do NOT output this string unless ALL stories pass.

## Progress File Format

Append to `ralph/progress.txt` in this format:

```
## [Story ID]: [Story Title] (PASS|FAIL)
- What you did (1-3 bullet points)
- Files modified
```
