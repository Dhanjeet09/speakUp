# Contributing

## Git Flow

- `main` — production-ready, auto-deploys
- Feature branches off `main`: `feat/description`, `fix/description`

## PR Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run lint` passes
- No `console.log` / commented code
- Types are preferred over `any`

## Code Style

- TypeScript strict mode
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas where possible
- Async handlers wrapped with `asyncHandler`
- Responses follow `{ success, data?, error? }` shape

## Commit Convention

```
feat: add matching by interest
fix: prevent duplicate queue join
chore: update deps
docs: add API reference
test: add streak unit tests
refactor: extract env validation
```
