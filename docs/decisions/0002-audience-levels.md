# 0002 Audience levels are the v1 headline

Status: accepted, 2026-10-22

## Decision

A reader picks an audience level (by default exec, manager or engineer; authors may declare their own)
and the diagram rewords itself for that reader. Audience level and zoom are separate axes: audience
changes the wording, zoom changes how deep into containment the reader sees.

The audience switch is always visible. Space is reserved for the longest wording of every audience, so
switching audience moves nothing on screen.

## Why

The core job is "how the system works, at my level". Mixed rooms (executives, managers, engineers) need
one shared picture that each person can read. This is what sets Aerie apart, so v1 leads with it.

## Consequences

- The language lets authors reword elements and relationships per audience (see 0003).
- Layout reserves space for every audience by default (see 0004).
- A rule check proves that switching audience moves nothing, on every view and audience.
