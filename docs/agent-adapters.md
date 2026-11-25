# Agent Adapters

This repository is deliberately **agent- and model-agnostic**. Every practice is expressed once, in a
neutral, plain-text form that any coding agent (or human) can use. This page explains how to plug those
neutral artifacts into whichever tool you use.

> Agent tools evolve quickly. Treat the tool-specific snippets below as starting points and confirm the
> current file names and schemas in your tool's own documentation.

## The Neutral Contract

| Concept            | Neutral artifact in this repo                                           | What your tool needs to do with it                                                          |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Operating rules    | [`AGENTS.md`](../AGENTS.md)                                             | Load it into every session as project instructions.                                         |
| Reusable workflows | [`.agents/skills/*/SKILL.md`](../.agents/skills/)                       | Expose them as skills / slash commands / saved prompts.                                     |
| Pre-edit guardrail | [`.agents/hooks/pre-tool-guard.sh`](../.agents/hooks/pre-tool-guard.sh) | Run it before any file write; block the write when it exits `2`.                            |
| Context exclusion  | [`.cursorignore`](../.cursorignore) (reference list)                    | Keep `traces/`, archived changes and build output out of agent context.                     |
| Model choice       | `model_routing.tier` in [`prompts/*.md`](../prompts/)                   | Map tiers to concrete models via `AI_MODEL_<TIER>` (see [`.env.example`](../.env.example)). |
| Agent's eyes       | `npm run verify:cli` ([`tools/calc-verify/`](../tools/calc-verify/))    | Let the agent run it as a shell command to observe the real UI.                             |
| Hard gates         | `npm run check` + CI                                                    | Nothing to wire: they run regardless of which agent wrote the code.                         |

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

## 5. Models & Providers (the app's AI feature)

This section is about the model the **product** uses (the Expression Translator), not the coding agent
you develop with. They are independent: you can build this repo with one vendor's agent and run the
feature on another vendor's model, or on a local one.

Prompts never name a vendor model. They declare a **tier** and a rationale, and configuration maps the
tier to a model:

```bash
AI_BASE_URL=<OpenAI-compatible Chat Completions base URL, e.g. ending in /v1>
AI_API_KEY=<key, if your provider needs one>
AI_MODEL_LIGHTWEIGHT=<a model id offered by that provider>
```

- The **app** (`npm run dev`), **evals** (`npm run eval`), and **trace demo** (`npm run trace:demo`) all read
  the same settings, so what you evaluate is what you run.
- Many hosted providers and local runtimes expose an OpenAI-compatible endpoint; check your provider's
  docs for its base URL. If yours doesn't, add a small client next to `createOpenAiCompatibleClient` in
  [`src/ai/model-clients.ts`](../src/ai/model-clients.ts). Nothing else needs to change.
- With nothing configured, everything uses the deterministic stub, so CI never needs a key.
- **Behind a corporate proxy?** Promptfoo routes model calls through `HTTPS_PROXY`, and in our testing it
  did so even for `localhost` despite `NO_PROXY`. If you evaluate a local model (e.g. on
  `http://localhost:11434/v1`), unset the proxy variables for that command.

Swapping vendors should be a configuration change that you **validate by re-running the same evals**,
never a code change. If scores drop after a swap, that's the evals doing their job.
