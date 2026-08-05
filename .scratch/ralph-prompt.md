# ISSUES

Local issue files from '.scratch/**/issues/ are provided at start of context. Parse them to understand the open issues.

** is the name of the PRD (Product Requirement Document) that the issue belongs to. The PRD contains the overall product vision, goals, and a list of features or tasks to be implemented. Each issue file corresponds to a specific task or feature outlined in the PRD.

You will work on the AFK issues only, not the HITL ones.

You've also been passed a file containing the last few commits.

Review these to understand what work has been done.

If all AFK tasks are complete, output ‹promise>NO MORE TASKS</ promise›.

# TASK SELECTION

Pick the next task. Prioritize tasks in this order:

1. Critical bugfixes
2. Development infrastructure

Getting development infrastructure like tests and types and dev scripts ready is an important precursor to building features.

3. Tracer bullets for new features

Tracer bullets are small slices of functionality that go through all layers of the system, allowing you to test and validate your approach early. This helps in identifying potential issues and ensures that the overall architecture is sound before investing significant time in development.

TL;DR - build a tiny, end-to-end slice of the feature first, then expand it out.

4. Polish and quick wins
5. Refactors

# EXPLORATION

Explore the repo.

# IMPLEMENTATION

Use /tdd skill to complete the task. It is possible to create unit tests or integration tests using the `prisma-test.utils.ts` to use a real database with the latest prisma schema.

# FEEDBACK LOOPS

Before committing, run the feedback loops:
- yarn run test' to run the tests
- yarn run build typecheck to run the type checker (if availabe)

# COMMIT
Make a git commit. The commit message must:

1. Include key decisions made
2. Include files changed
3. Blockers or notes for next iteration

# THE ISSUE

If the task is complete, move the issue file to '.scratch/**/issues/done/.

If the task is not complete, add a note to the issue file with what was done.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.