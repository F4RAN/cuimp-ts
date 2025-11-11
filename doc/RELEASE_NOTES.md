# Release Title

**v1.2.0 - Non-UTF-8 Encoding Support and Redirect Fixes**

---

# Release Notes

## 🎉 What's New

This release fixes critical issues with non-UTF-8 content handling and HTTP redirect processing, making cuimp compatible with a much wider range of websites and use cases.

## 🐛 Bug Fixes

### Preserve Raw Bytes in Response Body (Commit 1aed190)

**Problem:** The library was forcing UTF-8 decoding on all response bodies, causing irreversible data corruption for non-UTF-8 content (Chinese, Japanese, Korean, and legacy encodings).

**Solution:** 
- Keep response data as raw Buffer throughout processing
- Only decode HTTP headers as UTF-8 (per HTTP spec)
- Preserve original bytes in `rawBody` property for user-level decoding

**Impact:**
- ✅ Chinese websites (GBK, GB2312, Big5)
- ✅ Japanese websites (Shift-JIS, EUC-JP)
- ✅ Korean websites (EUC-KR)
- ✅ Legacy encodings (ISO-8859-1, Windows-1252)
- ✅ Binary content preservation

**Example:**
```javascript
const scraper = createCuimpHttp({ descriptor: { browser: 'chrome', version: '136' }});
const response = await scraper.get('https://example.com/gbk-page');
// Now you can properly decode non-UTF-8 content:
const html = iconv.decode(response.rawBody, 'gbk');
```

### Handle Multiple Redirects Correctly (Commit 98ad3d6)

**Problem:** After the raw bytes fix, redirect chains were broken because only the first HTTP response separator was found.

**Solution:**
- Find all separator occurrences in the response buffer
- Use the last separator to correctly split final headers from body
- Properly handle redirect chains (302 → 302 → 200)

**Impact:**
- ✅ HTTPS upgrades and redirects
- ✅ URL shorteners
- ✅ Authentication flows
- ✅ CDN and proxy redirect chains

## 🧪 Testing

All tests passing (22/22):
- ✓ Basic functionality tests (7/7)
- ✓ API tests (15/15)
- ✓ Real-world validation with GBK-encoded Chinese websites

## 💥 Breaking Changes

**None.** This is a bug fix release:
- The `rawBody` property already existed in the API
- It now works correctly instead of containing corrupted data
- All existing code continues to work as before
- New functionality is additive only

## 📝 Commits

- `1aed190` - fix: preserve raw bytes in response body to support non-UTF-8 encodings
- `98ad3d6` - fix: find all separators to handle multiple redirects correctly

## 🙏 Acknowledgments

Thanks to the community for identifying these critical encoding issues affecting international users!
