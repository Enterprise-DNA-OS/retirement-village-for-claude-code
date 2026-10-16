# Example Centrim Life files

Fictional records in the shape this system imports. Every name is invented.

- `residents.csv`: a resident list report from Centrim Life, saved from Excel as CSV. One row per resident; a couple in the same unit is two rows.
- `contracts.csv`: contract terms from the finance system (ingoing contribution, deferred management fee, weekly fee), one row per unit or contract.

```bash
npm run village -- import centrim --file=examples/centrim-life/residents.csv --dry-run
npm run village -- import terms --file=examples/centrim-life/contracts.csv --dry-run
```

Read `docs/replace-centrim-life.md` for the full switch.
