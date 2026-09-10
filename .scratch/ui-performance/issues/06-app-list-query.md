# 06 — Trim the app-list query

**What to build:** The app table and breadcrumb dropdowns load only the app fields actually needed, not the complete app model with all relations. The detail page keeps the full model.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A lean read variant of the app query exists for lists and breadcrumbs (display/navigation fields only).
- [ ] The app detail page still uses the full model including all relations.
- [ ] The transferred RSC payload size for the app list decreases (provable).
- [ ] Search, sorting, and display of the app table stay unchanged.
- [ ] Cache tags and invalidation stay functional; existing app-service tests stay green.
