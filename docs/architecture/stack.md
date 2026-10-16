# Stack

**Status: NOT DECIDED**

The stack will be selected via a dedicated stack-selection task. Until this file is filled in:

- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency.
- The Builder MUST report `blocked` if asked to implement code before the stack is decided.
- The Planner may write stack-agnostic specs but MUST flag stack-dependent decisions as open questions.

When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`.
