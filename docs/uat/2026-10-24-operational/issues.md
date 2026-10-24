# Operational UAT issue tracker

The full evidence is in [the audit report](report.md). Issues are ordered by the original finding number; implementation starts with findings 1 and 2.

| Finding | Priority | Issue                                                                                                                                  |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | P1       | [#86: Keep the diagram visible after valid structural edits](https://github.com/Brizton-Floyd/aerie-diagrams/issues/86)                |
| 2       | P1       | [#87: Make sharing local and edited models explicit and safe](https://github.com/Brizton-Floyd/aerie-diagrams/issues/87)               |
| 3       | P2       | [#88: Preserve the previous model and picture in browser Back history](https://github.com/Brizton-Floyd/aerie-diagrams/issues/88)      |
| 4       | P2       | [#89: Explain unknown model links instead of silently substituting a model](https://github.com/Brizton-Floyd/aerie-diagrams/issues/89) |
| 5       | P2       | [#90: Preserve keyboard focus after activating an overview badge](https://github.com/Brizton-Floyd/aerie-diagrams/issues/90)           |
| 6       | P2       | [#91: Reveal keyboard-focused overview badges without selecting them](https://github.com/Brizton-Floyd/aerie-diagrams/issues/91)       |
| 7       | P2       | [#92: Support keyboard resizing of the split editor](https://github.com/Brizton-Floyd/aerie-diagrams/issues/92)                        |
| 8       | P1       | [#93: Open element details from the default flow overview](https://github.com/Brizton-Floyd/aerie-diagrams/issues/93)                  |
| 9       | P2       | [#94: Make local draft state and reload recovery visible](https://github.com/Brizton-Floyd/aerie-diagrams/issues/94)                   |
| 10      | P2       | [#95: Keep details and primary actions reachable in narrow desktop windows](https://github.com/Brizton-Floyd/aerie-diagrams/issues/95) |
| 11      | P3       | [#96: Distinguish same-named models in the model chooser](https://github.com/Brizton-Floyd/aerie-diagrams/issues/96)                   |
| 12      | P3       | [#97: Count or label the implicit Overview consistently](https://github.com/Brizton-Floyd/aerie-diagrams/issues/97)                    |
| 13      | P2       | [#98: Expose contextual technical wording in stage explanations](https://github.com/Brizton-Floyd/aerie-diagrams/issues/98)            |

The element-details issue links the already prepared PR 85. Narrow-window support remains a deferred-scope enhancement, not a regression against the v1 size contract.

## Implementation queue

1. [#86](https://github.com/Brizton-Floyd/aerie-diagrams/issues/86): implemented in [PR #99](https://github.com/Brizton-Floyd/aerie-diagrams/pull/99). The full local Linux gate passed.
2. [#87](https://github.com/Brizton-Floyd/aerie-diagrams/issues/87): implemented in [PR #100](https://github.com/Brizton-Floyd/aerie-diagrams/pull/100). The full local Linux gate passed, including all 122 browser journeys.
3. [#93](https://github.com/Brizton-Floyd/aerie-diagrams/issues/93): the existing element-details fix is prepared in [PR #85](https://github.com/Brizton-Floyd/aerie-diagrams/pull/85).
4. Remaining P2 defects and usability gaps follow in audit order, then the P3 findings. Narrow-window support remains deferred scope.

All three fixes remain in draft pull requests for review. Both new fixes could not start CI because of an account-level GitHub Actions restriction. Issues remain open until their fixes merge.
