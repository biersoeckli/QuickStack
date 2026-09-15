# 05 — Kern-Komponenten auf `new-york` neu beziehen (Batch A)

**What to build:** Die zentralen Formular- und Anzeige-Primitives (Button, Input, Label, Card,
Checkbox, Switch, Tabs, Select, Progress und Verwandte) laufen auf dem aktuellen shadcn-Stand mit
Tailwind-v4-Klassen, `data-slot`-Attributen und ohne `forwardRef` — lokale Anpassungen bleiben erhalten.

**Blocked by:** 02 — UI-Komponenten inventarisieren; 03 — Tailwind CSS auf v4 upgraden;
04 — Theme auf OKLCH migrieren und Base-Color festlegen.

**Status:** ready-for-agent

- [ ] Batch-A-Komponenten sind gegen die Registry gediffed und einzeln gemergt, nicht blind überschrieben.
- [ ] Lokale Anpassungen aus der Inventur sind in den Ergebnissen erhalten.
- [ ] Keine `forwardRef`-Nutzung mehr in den neu bezogenen Komponenten.
- [ ] Importe lösen auf; `yarn lint` und `yarn build` sind grün.
- [ ] Betroffene Screens (Formulare, Dialoge mit Kern-Inputs) funktionieren in der Sichtprüfung.
