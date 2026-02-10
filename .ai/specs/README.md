# Specifications & Architecture Decision Records

This folder contains specifications and Architecture Decision Records (ADRs) that serve as the source of truth for design decisions and module behavior in Open Mercato.

## Purpose

The `.ai/specs/` folder is the central repository for:
- **Specifications**: Documented design decisions with context, alternatives considered, and rationale
- **Feature specifications**: Detailed descriptions of module functionality, API contracts, and data models
- **Implementation reference**: Living documentation that stays synchronized with the codebase
- **AI agent guidance**: Structured information that helps both humans and AI agents understand system behavior

## Naming Convention

### Specification Files
Specification files follow the pattern `SPEC-{number}-{date}-{title}.md`:

- **Number**: Sequential identifier (e.g., `001`, `002`, `003`)
- **Date**: Creation date in ISO format (`YYYY-MM-DD`)
- **Title**: Descriptive kebab-case title (e.g., `sidebar-reorganization`, `messages-module`)

**Example**: `SPEC-007-2026-01-26-sidebar-reorganization.md`

### Meta-Documentation Files
Files like `AGENTS.md` and `CLAUDE.md` use UPPERCASE names and are not numbered—they provide guidelines for working with the specs themselves.

## Specification Directory

### Meta-Documentation

- [AGENTS.md](AGENTS.md) - Guidelines for AI agents and humans working with specs
- [CLAUDE.md](CLAUDE.md) - Claude-specific instructions (currently a placeholder)

### Specifications

| SPEC | Date | Title | Description |
| --- | --- | --- | --- |
| [SPEC-001-2026-02-10-core-module-architecture.md](SPEC-001-2026-02-10-core-module-architecture.md) | 2026-02-10 | Core Module Architecture | Baseline layered architecture across TypeScript, Nitro contracts, native implementations, and exports. |
| [SPEC-002-2026-02-10-use-payment-checkout-flow.md](SPEC-002-2026-02-10-use-payment-checkout-flow.md) | 2026-02-10 | usePaymentCheckout Flow | Behavioral contract for checkout hook lifecycle, cart state, and payment execution semantics. |
| [SPEC-003-2026-02-10-expo-config-plugin-contract.md](SPEC-003-2026-02-10-expo-config-plugin-contract.md) | 2026-02-10 | Expo Config Plugin Contract | Build-time configuration contract for Apple Pay entitlements and Google Pay Android metadata. |
| [SPEC-004-2026-02-10-testing-and-quality-gates.md](SPEC-004-2026-02-10-testing-and-quality-gates.md) | 2026-02-10 | Testing and Quality Gates | Validation requirements and CI quality baseline for safe multi-layer changes. |

## Specification Structure

Each specification should include the following sections:

1. **Overview** – What the feature/decision is about and its purpose
2. **Problem Statement** – The problem being solved or the decision being made
3. **Proposed Solution** – The chosen approach with detailed design
4. **Architecture** – High-level design and component relationships
5. **Data Models** – Entity definitions, relationships, and database schema (if applicable)
6. **API Contracts** – Endpoints, request/response schemas, and examples (if applicable)
7. **UI/UX** – Frontend components and user interactions (if applicable)
8. **Configuration** – Environment variables, feature flags, and settings (if applicable)
9. **Alternatives Considered** – Other options evaluated and why they were not chosen
10. **Implementation Approach** – Step-by-step implementation plan
11. **Migration Path** – How to migrate from the old approach (if applicable)
12. **Success Metrics** – How to measure if the solution is working
13. **Open Questions** – Unresolved questions or future considerations
14. **Changelog** – Version history with dates and summaries

### Changelog Format

Every ADR must maintain a changelog at the bottom:

```markdown
## Changelog

### 2026-01-23
- Added email notification channel support
- Updated notification preferences API

### 2026-01-15
- Initial specification
```

## Workflow

### Before Coding

1. Check if a specification exists for the module you're modifying
2. Read the spec to understand design intent and constraints
3. Identify gaps or outdated sections

### When Adding Features

1. Update the corresponding specification file with:
   - New functionality description
   - API changes
   - Data model updates
2. Add a changelog entry with the date and summary

### When Creating New Modules

1. Create a new specification file at `.ai/specs/SPEC-{next-number}-{YYYY-MM-DD}-{module-name}.md`
2. Document the initial design before or alongside implementation
3. Include a changelog entry for the initial specification
4. Update this README.md with a link to the new specification

### After Coding

Even when not explicitly asked to update specifications:

- Generate or update the specification when implementing significant changes
- Keep specifications synchronized with actual implementation
- Document architectural decisions made during development

## For AI Agents

AI agents working on this codebase should:

1. **Always check** for existing specifications before making changes
2. **Reference specifications** to understand module behavior and constraints
3. **Update specifications** when implementing features, even if not explicitly requested
4. **Create specifications** for new modules or significant features following the naming convention
5. **Maintain changelogs** with clear, dated entries
6. **Update this README.md** when adding new specifications to the directory table

This ensures the `.ai/specs/` folder remains a reliable reference for understanding module behavior and evolution over time.

## Related Resources

- **Root AGENTS.md**: See [/AGENTS.md](../../AGENTS.md) for comprehensive development guidelines
- **Root CONTRIBUTING.md**: See [/CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution workflow