# Shareboard — Software Specification

| | |
|--|--|
| Product | Shareboard, a real-time collaborative whiteboard |
| Platforms | Web (any modern browser), Android app, shared backend |
| Document set version | 1.0 (2026-11-02), matches app release 1.8.x-beta |
| Status | Living document: updated with every feature change |

This folder is the formal specification of Shareboard. It describes **what**
the product does and **how well** it must do it. How it is built lives in
[`../architecture/`](../architecture/overview.md); how it looks lives in
[`../design-planning/`](../design-planning/mockups.html).

| # | Document | Answers |
|---|----------|---------|
| 1 | [Product overview](product-overview.md) | What is Shareboard, for whom, and how is it organised? |
| 2 | [Functional requirements](functional-requirements.md) | What must the system do? (FR-xx) |
| 3 | [Non-functional requirements](non-functional-requirements.md) | How well must it do it? (NFR-xx) |
| 4 | [Use cases](use-cases.md) | How do actors reach their goals, step by step? (UC-xx) |

## Conventions

- **Requirement IDs** are stable. A removed requirement keeps its number and
  is marked *Withdrawn*; new ones take the next free number.
- **Priority** uses MoSCoW: **M** must, **S** should, **C** could.
- **Platform tags**: **[W]** web, **[A]** Android, **[S]** server. A
  requirement with no tag applies to both clients.
- **Status**: every requirement listed here is implemented in the current
  release unless it says *Planned*.
- "The user" means any person using a client. Specific roles are defined in
  [Product overview → Actors and roles](product-overview.md#actors-and-roles).

## Traceability

Each use case lists the functional requirements it exercises, and each
requirement group points to the section of the [user guide](../user-guide/features.md)
that explains it to end users. Design notes explaining *why* a behaviour was
chosen are in [`../plans/`](../plans/).
