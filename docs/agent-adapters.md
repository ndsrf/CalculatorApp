# Agent Adapters

This repository is deliberately **agent- and model-agnostic**. Every practice is expressed once, in a
neutral, plain-text form that any coding agent (or human) can use. This page explains how to plug those
neutral artifacts into whichever tool you use.

> Agent tools evolve quickly. Treat the tool-specific snippets below as starting points and confirm the
> current file names and schemas in your tool's own documentation.

## The Neutral Contract

| Concept            | Neutral artifact in this repo                                           | What your tool needs to do with it                                                               |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Operating rules    | [`AGENTS.md`](../AGENTS.md)                                             | Load it into every session as project instructions.                                              |
| Reusable workflows | [`.agents/skills/*/SKILL.md`](../.agents/skills/)                       | Expose them as skills / slash commands / saved prompts.                                          |
| Pre-edit guardrail | [`.agents/hooks/pre-tool-guard.sh`](../.agents/hooks/pre-tool-guard.sh) | Run it before any file write; block the write when it exits `2`.                                 |
| Context exclusion  | [`.cursorignore`](../.cursorignore) (reference list)                    | Keep `traces/`, archived changes and build output out of agent context.                          |
| Model choice       | `model_routing.tier` in [`prompts/*.md`](../prompts/)                   | Map tiers to concrete models via `EVAL_PROVIDER_<TIER>` (see [`.env.example`](../.env.example)). |
| Agent's eyes       | `npm run verify:cli` ([`tools/calc-verify/`](../tools/calc-verify/))    | Let the agent run it as a shell command to observe the real UI.                                  |
| Hard gates         | `npm run check` + CI                                                    | Nothing to wire: they run regardless of which agent wrote the code.                              |

The last row is the important one: **the gates that matter most do not depend on the agent at all.** If
your tool supports none of the adapters below, the repo still protects itself through linters, tests,
evals, CI, and CODEOWNERS.

## 1. Operating Rules (`AGENTS.md`)

`AGENTS.md` is an open, cross-vendor convention ([agents.md](https://agents.md)) that many coding agents
read automatically from the repository root (and from subdirectories, for scoped rules).

If your tool uses its own file name instead, **do not copy the rules.** Create a one-line pointer so there
is still a single source of truth, for example:

- A tool that reads `CLAUDE.md` and supports `@path` imports: a `CLAUDE.md` containing just `@AGENTS.md`.
- A tool that reads a different file without import support: a symlink to `AGENTS.md`.

## 2. Skills (`.agents/skills/`)

Each skill is a folder with a `SKILL.md` (YAML frontmatter `name` + `description`, then instructions).
Tools that support this format can load the folder directly or via a symlink into their own skills
directory (for example `ln -s ../.agents/skills .<tool>/skills`). Tools without skill support can still
use them: paste or reference the `SKILL.md` as a prompt ("Follow `.agents/skills/code-review/SKILL.md`").

The `agents/openai.yaml` files next to some skills are optional, vendor-specific UI metadata shipped by
the upstream skill author; tools that don't recognise them ignore them.

## 3. Pre-Edit Guardrail Hook

`.agents/hooks/pre-tool-guard.sh` is a plain Bash script with a portable contract:

- **Input:** a file path as the first argument, _or_ a JSON payload on stdin containing a `file_path`
  (or `path`) field. That is the shape most agent hook systems send.
- **Output:** exit `0` to allow, exit `2` to block (reason on stderr, which most hosts feed back to the
  agent so it can self-correct), exit `1` on usage errors. Payloads without a file path are allowed.

Wire it to your tool's "before file edit/write" event. For example, in a tool that uses a
`PreToolUse`-style JSON settings file:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": ".agents/hooks/pre-tool-guard.sh" }]
      }
    ]
  }
}
```

Behaviour is covered by [`tests/pre-tool-guard.test.ts`](../tests/pre-tool-guard.test.ts), so you can
change hosts without re-validating the logic.

**Know its limits:** a file-edit hook does not see writes made through a shell (`sed -i`, `cat >`), and an
agent with unrestricted shell access could bypass it. Treat it as a fast, friendly first line of defense.
The authoritative protection is server-side: CODEOWNERS + branch protection + CI.

## 4. Context Exclusion

There is no cross-tool standard yet. `.cursorignore` holds the reference list of paths that should
not consume agent context (`traces/`, `openspec/changes/archive/`, `dist/`, test reports, `node_modules/`).
Mirror that list in whatever mechanism your tool provides (an ignore file, a deny-list in its settings, or
workspace exclusions). `.gitignore`d paths are already excluded by most tools.

## 5. Models & Providers

Prompts never name a vendor model. They declare a **tier** (`frontier` or `lightweight`) and a rationale.
`npm run eval` resolves each tier from environment variables:

```bash
EVAL_PROVIDER_FRONTIER=<any Promptfoo provider id>
EVAL_PROVIDER_LIGHTWEIGHT=<any Promptfoo provider id>
EVAL_PROVIDER_JUDGE=<optional; defaults to the frontier provider>
```

Any [Promptfoo provider](https://www.promptfoo.dev/docs/providers/) works, including fully local models.
With nothing configured, evals run offline against a deterministic stub so CI never needs a key.

Swapping vendors should be a configuration change that you **validate by re-running the same evals**,
never a code change. If scores drop after a swap, that's the evals doing their job.
