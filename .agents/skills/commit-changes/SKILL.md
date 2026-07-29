---
name: commit-changes
description: Create focused Git commits with concise, explicit English messages and optionally push them. Use whenever the user asks to commit, create a commit, commit changes, push a commit, or commit and push.
---

# Commit Changes

Create one intentional commit for the requested work. Match the repository's recent commit style unless the user specifies a message or convention.

## Workflow

1. Inspect `git status -sb`, the relevant diff, and recent commit subjects with `git log --oneline -10`.
2. Infer the commit style from recent history. Default to a short, explicit English subject starting with a capitalized verb; avoid conventional-commit prefixes and trailing periods unless the repository uses them.
3. Confirm the intended scope. If the worktree is mixed, stage only the requested files or hunks; ask the user when ownership is unclear. Never stage unrelated changes.
4. If starting from the default branch, create `codex/<short-topic>` unless the user asked to commit directly to that branch. Keep the current branch otherwise.
5. Run the most relevant available checks, unless they already passed after the requested changes.
6. Commit with the selected subject. Push with upstream tracking only when the user asks to push.

## Commit Message Style

Prefer messages such as `Add grouped system notifications`, `Improve mobile conversation layout`, or `Update attachment preview`. The subject should state the user-facing change clearly in one line.

## Safety

Do not amend, force-push, stage all files, or create a pull request unless the user explicitly asks. Report the committed files, commit hash, branch, push result, and any uncommitted changes that remain.
