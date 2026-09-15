# 08 — `cn`-Utility auf das `cn`-Package migrieren

**What to build:** `clsx` und `tailwind-merge` werden durch das `cn`-Package ersetzt; die lokale
`cn`-Utility re-exportiert nur noch. Voraussetzung ist Tailwind v4, weil die Merge-Engine darauf targetet.

**Blocked by:** 03 — Tailwind CSS auf v4 upgraden; 06 — Komplexe Komponenten neu beziehen.

**Status:** ready-for-agent

- [ ] `shadcn migrate cn` ist ausgeführt; die Utility re-exportiert aus `cn`.
- [ ] `clsx` und `tailwind-merge` sind entfernt, wenn nichts mehr darauf verweist.
- [ ] Verbleibende direkte Nutzungen wurden migriert oder bewusst belassen und dokumentiert.
- [ ] `yarn lint`, `yarn build` und `yarn test` sind grün.
