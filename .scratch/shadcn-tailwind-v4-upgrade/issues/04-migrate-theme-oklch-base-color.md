# 04 — Theme auf OKLCH migrieren und Base-Color festlegen

**What to build:** Die Theme-Tokens nutzen die aktuelle shadcn/OKLCH-Konvention; Hell- und
Dunkelmodus sind konsistent, die Base-Color ist bewusst gewählt, und Charts lesen die
Theme-Variablen direkt.

**Blocked by:** 03 — Tailwind CSS auf v4 upgraden.

**Status:** ready-for-agent

- [ ] `:root` und `.dark` liegen außerhalb von `@layer`; Farbwerte sind in `hsl()`/OKLCH gewrappt.
- [ ] `@theme inline` referenziert die Variablen ohne Farbwrapper.
- [ ] Base-Color-Entscheidung ist dokumentiert und konsistent auf alle Tokens angewendet.
- [ ] Chart-Konfiguration nutzt `var(--chart-N)` ohne `hsl()`-Wrapper.
- [ ] Sidebar-Variablen lösen weiterhin auf.
- [ ] Sichtprüfung Hell/Dunkel bestätigt Kontrast und Lesbarkeit.
