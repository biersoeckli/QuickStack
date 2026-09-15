# 07 — Radix auf das unified `radix-ui`-Package vereinheitlichen

**What to build:** Alle Primitives importieren aus dem einen `radix-ui`-Package; die vielen
einzelnen `@radix-ui/react-*`-Abhängigkeiten verschwinden, ohne dass sich Verhalten ändert.

**Blocked by:** 05 — Kern-Komponenten neu beziehen; 06 — Komplexe Komponenten neu beziehen.

**Status:** ready-for-agent

- [ ] Primitive-Importe sind per `shadcn migrate radix` migriert.
- [ ] Ungenutzte `@radix-ui/react-*`-Pakete sind aus der `package.json` entfernt.
- [ ] `yarn install` ist sauber; `yarn lint`, `yarn build` und `yarn test` sind grün.
- [ ] Sichtprüfung: Radix-basierte Overlays/Menüs verhalten sich unverändert.
