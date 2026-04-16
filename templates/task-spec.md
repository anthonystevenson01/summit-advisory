---
# Task Spec — [Short Feature Name]
# Copy this file to task-spec.md in your repo root, fill it in, then tell Claude:
#   "Run the pipeline on task-spec.md"

objective: >
  # One paragraph describing what needs to be built or fixed.
  # Be specific: what the feature does, who uses it, what problem it solves.

acceptance_criteria:
  # List every condition that must be true for this task to be considered done.
  # Write these as verifiable statements — the Reviewer agent checks code against each one.
  # Example:
  #   1. Running `npm run dev` starts the app with no errors
  #   2. The /dashboard route renders a data table with pagination
  #   3. Table supports sorting by clicking column headers
  #   4. Unit tests cover sorting logic and pagination edge cases
  1.
  2.
  3.

project_setup:
  # type: "new"      — scaffold a brand-new project from scratch
  # type: "existing" — modify an existing codebase
  type: existing

  # Only fill in 'stack' and 'output_directory' if type = "new"
  stack:
    framework:       # e.g. nextjs-15 / fastapi / gin
    language:        # e.g. typescript / python / go
    styling:         # e.g. tailwindcss-v4 / scss / none
    package_manager: # e.g. npm / pnpm / pip / go mod
    runtime:         # e.g. node-20 / python-3.12 / go-1.22
  output_directory:  # e.g. projects/my-app

  # Only fill in 'run_command' if type = "new"
  run_command:       # e.g. cd projects/my-app && npm run dev

constraints:
  # Hard rules the agents must not violate.
  # Be explicit — vague constraints get ignored.
  # Examples:
  #   - No external form libraries — use React state only
  #   - All API calls must go through src/clients/ — no raw fetch elsewhere
  #   - Secrets via environment variables only — never hardcoded
  #   - Do not modify the database schema — read-only access only
  -

codebase_context:
  # List the files agents should read before starting.
  # For existing projects: list the files that are most relevant to this task.
  # For new projects: leave empty or list any reference files.
  # Examples:
  #   - src/routes/users.ts
  #   - src/models/user.py
  #   - docs/api-spec.md
  -

output_format: >
  # Optional. Describe the expected output if it's not obvious from the objective.
  # For new projects: list every file that must be created.
  # For existing projects: describe the changed behaviour.

ticket_id:
  # The ID from your issue tracker. Used for branch naming and commit messages.
  # Examples: GH-45, PROJ-122, ENG-88
  # Leave blank if this task has no ticket.

owner:
  # The developer responsible for this task (used in branch naming if no ticket_id).
  # Example: dev-1, talha, frontend-team

priority:
  # low / medium / high / critical

required_access:
  # List any third-party services, API keys, or accounts needed to implement this task.
  # The Orchestrator will ask the human to provide these before starting.
  # Examples:
  #   - name: SENDGRID_API_KEY
  #     why: To send emails from the contact form
  #     where_to_get: https://app.sendgrid.com/settings/api_keys
  #   - name: STRIPE_SECRET_KEY
  #     why: To process payments
  #     where_to_get: https://dashboard.stripe.com/apikeys

notes: >
  # Optional. Anything else the agents should know:
  #   - Known edge cases
  #   - Past decisions and why they were made
  #   - Links to relevant docs or designs
  #   - Warnings about fragile areas of the codebase

---
