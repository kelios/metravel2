# ADR: API Error and Validation Contract

> **Status:** Accepted  
> **Date:** 2026-03-02  
> **Deciders:** Architecture review  
> **Context:** Refactoring Plan, Фаза 6 (L3)

---

## Context

API error handling is scattered across individual API modules with inconsistent patterns:
- Some use `ApiError` class, others throw raw errors
- Error status extraction duplicated in multiple files
- Validation errors mixed with network errors
- No standard error shape for consumers (hooks/components)

---

## Decision

### Standard error shape

All API functions must normalize errors through consistent types:

```typescript
// api/client.ts — already exists
class ApiError extends Error {
  status: number;
  data: unknown;
}

// api/parsers/apiResponseParser.ts — shared utility
function getErrorStatus(error: unknown): number | null;
function isAbortError(error: unknown): boolean;
```

### Error handling rules

| Layer | Responsibility | Pattern |
|-------|---------------|---------|
| `api/client.ts` | HTTP errors to `ApiError` | `throw new ApiError(status, data, message)` |
| `api/*.ts` modules | Domain-specific error enrichment | Catch `ApiError`, add context, re-throw or return fallback |
| `hooks/` | User-facing error messages | Catch errors, extract status via `getErrorStatus()`, show toast |
| `components/` | Display only | Never catch API errors directly |

### Validation contract

```typescript
// utils/formValidation.ts — already exists
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
}
```

### Rules

1. **Never use `catch(e: any)`** — always `catch(e: unknown)` with type narrowing
2. **Always check `isAbortError()`** before logging — AbortErrors are expected during navigation
3. **Use `getErrorStatus()`** from `api/parsers/apiResponseParser.ts` for status extraction
4. **API modules return fallback data** on non-critical errors (e.g., `{ data: [], total: 0 }`)
5. **API modules throw** on critical errors (auth failures, validation errors)
6. **Hooks show toasts** for user-facing errors; API modules only `devError()` log

### Token refresh flow

1. `apiClient` detects 401 -> attempts token refresh via `api/auth.ts`
2. If refresh succeeds -> retry original request
3. If refresh fails -> throw `ApiError(401)` -> hooks redirect to login

---

## Consequences

### Positive
- Consistent error handling across all API consumers
- Type-safe error extraction (no `as any` for error fields)
- Clear separation: API logs internally, hooks show to users

### Negative
- Existing error handling in some hooks may need updating to use `getErrorStatus()`

---

## References

- `api/client.ts` — `ApiError` class
- `api/parsers/apiResponseParser.ts` — `getErrorStatus()`, `isAbortError()`
- `utils/formValidation.ts` — `ValidationResult`, `ValidationError`
