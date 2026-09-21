# QRCC Data Center — Task List

Checklist ringkas implementasi. Detail arsitektur ada di
`implementation-plan.md`; detail testing, risiko, dan delivery ada di
`implementation-quality-delivery.md`.

## Sprint 0 — Project Foundation

- [ ] TASK-001 — Initialize Nuxt project
- [ ] TASK-002 — Configure Nuxt UI
- [ ] TASK-003 — Configure code quality

## Sprint 1 — Database Foundation

- [ ] TASK-004 — Configure SQLite + Drizzle
- [ ] TASK-005 — Implement database schemas
- [ ] TASK-006 — Add indexes and constraints
- [ ] TASK-007 — Add audit fields

## Sprint 2 — Authentication

- [ ] TASK-008 — Better-auth setup
- [ ] TASK-009 — Protected routes

## Sprint 3 — File Infrastructure

- [ ] TASK-010 — File storage service
- [ ] TASK-011 — File validation
- [ ] TASK-012 — Attachment service

## Sprint 4 — Quality Issue

- [ ] TASK-013 — Quality Issue repository
- [ ] TASK-014 — Quality Issue service
- [ ] TASK-015 — Create Quality Issue API
- [ ] TASK-016 — Quality Issue list UI
- [ ] TASK-017 — Quality Issue create UI
- [ ] TASK-018 — Quality Issue detail and progress

## Sprint 5 — Sample Defect

- [ ] TASK-019 — Sample repository
- [ ] TASK-020 — Sample state machine
- [ ] TASK-021 — Batch request
- [ ] TASK-022 — Receive sample
- [ ] TASK-023 — QRCC verification
- [ ] TASK-024 — PQA handover
- [ ] TASK-025 — PQA analysis
- [ ] TASK-026 — Supplier analysis
- [ ] TASK-027 — Sample Defect UI

## Sprint 6 — Technical Report

- [ ] TASK-028 — Technical Report repository
- [ ] TASK-029 — Technical Report service
- [ ] TASK-030 — Technical Report creation
- [ ] TASK-031 — Technical Report UI

## Sprint 7 — Dashboard

- [ ] TASK-032 — Dashboard aggregation
- [ ] TASK-033 — Dashboard UI

## Sprint 8 — Search, Filter, and Export

- [ ] TASK-034 — Generic pagination
- [ ] TASK-035 — Excel export
- [ ] TASK-036 — PDF export

## Sprint 9 — Admin Operations

- [ ] TASK-037 — Delete Quality Issue
- [ ] TASK-038 — Delete Sample Defect
- [ ] TASK-039 — Delete Technical Report
- [ ] TASK-040 — Rollback state

## Sprint 10 — Backup and Reliability

- [ ] TASK-041 — Weekly backup
- [ ] TASK-042 — Backup retention
- [ ] TASK-043 — Backup integrity verification
- [ ] TASK-044 — Restore procedure

## Final Verification

- [ ] TypeScript check passes
- [ ] Lint and format checks pass
- [ ] Database migration works from a clean database
- [ ] Authentication and protected API are verified
- [ ] Quality Issue flow is verified
- [ ] Sample Defect batch and state flow are verified
- [ ] Technical Report flow is verified
- [ ] Attachment cleanup is verified
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E critical flows pass
- [ ] Export is verified
- [ ] Backup integrity and restore are verified
- [ ] Local build and smoke test pass
