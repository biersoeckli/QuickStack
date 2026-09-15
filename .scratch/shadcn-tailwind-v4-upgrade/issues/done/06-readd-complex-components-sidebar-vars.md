# 06 — Komplexe Komponenten neu beziehen und Sidebar-Variablen umbenennen (Batch B)

**What to build:** Die aufwendigen Komponenten (Sidebar, Command-Palette, Menüs/Overlays,
Data-Table-Helfer, Chart, Sheet/Drawer) laufen auf dem aktuellen shadcn-Stand. Die Sidebar nutzt die
aktuellen semantischen Variablennamen statt der alten.

**Blocked by:** 02 — UI-Komponenten inventarisieren; 03 — Tailwind CSS auf v4 upgraden;
04 — Theme auf OKLCH migrieren und Base-Color festlegen.

**Status:** ready-for-agent

- [ ] Batch-B-Komponenten sind einzeln gediffed und gemergt; lokale Anpassungen erhalten.
- [ ] Alte Sidebar-Variablennamen sind auf die aktuellen umgestellt und alle Verwendungen mitgezogen.
- [ ] `yarn lint` und `yarn build` sind grün.
- [ ] Sichtprüfung: Sidebar (inkl. Collapse/Icon-Modus), Data-Table, Command-Palette und Overlays funktionieren.
