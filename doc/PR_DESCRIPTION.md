# Fix: Find all separators to handle multiple redirects correctly

## Problem

After the previous fix (#PR_NUMBER) that preserved raw bytes, a test failure revealed an issue with redirect handling:

```
FAIL  test/basic.test.ts > should handle multiple redirects in response
```

The issue: when using `indexOf()` to find the first `\r\n\r\n` separator, it fails with redirect chains because the response contains multiple HTTP response blocks:

```
HTTP/1.1 302 Found
Location: /redirect1
\r\n\r\n
HTTP/1.1 302 Found
Location: /redirect2
\r\n\r\n
HTTP/1.1 200 OK
Content-Type: text/html
\r\n\r\n
<actual body content>
```

Using the **first** separator would incorrectly treat all subsequent HTTP responses and the final body as "body content".

## Solution

Find **all** separator occurrences and use the **last** one to correctly split the final headers from the actual body:

```typescript
// Find ALL separators (\r\n\r\n or \n\n)
const separatorPositions: Array<{index: number, length: number}> = [];
for (let i = 0; i < stdoutBuf.length; i++) {
  if (stdoutBuf.slice(i, i + 4).equals(separator1)) {
    separatorPositions.push({index: i, length: 4});
    i += 3; // Skip past this separator
  } else if (stdoutBuf.slice(i, i + 2).equals(separator2)) {
    separatorPositions.push({index: i, length: 2});
    i += 1;
  }
}

// Use LAST separator for final headers/body boundary
if (separatorPositions.length > 0) {
  const lastSeparator = separatorPositions[separatorPositions.length - 1];
  const headerBuf = stdoutBuf.slice(0, lastSeparator.index);
  const rawBody = stdoutBuf.slice(lastSeparator.index + lastSeparator.length);
  // ...
}
```

### Key Changes

1. **Iterate through entire buffer** to find all separator positions
2. **Store positions with lengths** to handle both `\r\n\r\n` (4 bytes) and `\n\n` (2 bytes)
3. **Use last separator** as the true boundary between final headers and body
4. **Skip ahead** after finding separator to avoid overlapping matches

## Testing

### Unit Tests
All tests now pass (22/22), including the redirect test:
```
✓ test/basic.test.ts (7)
  ✓ should handle multiple redirects in response
✓ test/api.test.ts (15)
Test Files  2 passed (2)
Tests  22 passed (22)
```

### Edge Cases Handled
- Single redirect: `302 → 200`
- Multiple redirects: `302 → 302 → 200`
- Direct response: No redirects
- Both separator formats: `\r\n\r\n` and `\n\n`

## Breaking Changes

**None.** This builds upon the previous raw bytes fix and corrects an edge case that was broken by that change.

## Impact

This ensures correct behavior when:
- Following HTTP redirects (common for HTTPS upgrades, URL shorteners)
- Handling authentication flows that involve multiple round-trips
- Working with CDNs or proxies that add redirect hops
- Combined with the raw bytes fix, now properly handles redirects **and** non-UTF-8 encodings simultaneously
