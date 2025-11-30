# Cuimp Examples

This directory contains runnable examples demonstrating various features of the `cuimp` library.

## Prerequisites

1. Make sure you have Node.js >= 18.17 installed
2. Install dependencies: `npm install`
3. Build the project: `npm run build`

## Running Examples

All examples can be run directly with Node.js:

```bash
# Make sure the project is built first
npm run build

# Run a specific example
node examples/01-basic-requests.js

# Or make them executable and run directly
chmod +x examples/*.js
./examples/01-basic-requests.js

# List all available examples
ls examples/*.js
```

## Example Files

### 01-basic-requests.js
Demonstrates basic GET and POST requests using the convenience functions.

```bash
node examples/01-basic-requests.js
```

### 02-browser-impersonation.js
Shows how to impersonate different browsers (Chrome, Firefox, Edge, Safari).

```bash
node examples/02-browser-impersonation.js
```

### 03-http-client.js
Demonstrates using a reusable HTTP client instance with default configuration.

```bash
node examples/03-http-client.js
```

### 04-all-methods.js
Examples of all available HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.

```bash
node examples/04-all-methods.js
```

### 05-proxy-example.js
Shows how to configure and use HTTP, HTTPS, and SOCKS proxies.

```bash
node examples/05-proxy-example.js
```

### 06-error-handling.js
Demonstrates proper error handling for various error scenarios.

```bash
node examples/06-error-handling.js
```

### 07-binary-management.js
Shows how to download and manage curl-impersonate binaries.

```bash
node examples/07-binary-management.js
```

### 08-web-scraping.js
A practical example of web scraping with browser impersonation.

```bash
node examples/08-web-scraping.js
```

### 09-advanced-config.js
Demonstrates advanced configuration options like timeouts, redirects, and request cancellation.

```bash
node examples/09-advanced-config.js
```

## Running All Examples

You can run all examples in sequence:

```bash
for file in examples/*.js; do
  if [ "$(basename $file)" != "README.md" ]; then
    echo "Running $(basename $file)..."
    node "$file"
    echo ""
  fi
done
```

## Notes

- All examples use `httpbin.org` for testing, which is a free HTTP testing service
- Some examples may take a few seconds to complete due to binary downloads on first run
- Binary downloads are cached and reused between runs
- Make sure you have an internet connection for the examples to work

## Customization

Feel free to modify these examples to suit your needs:

- Change the URLs to test against your own APIs
- Modify browser versions and configurations
- Add your own proxy configurations
- Experiment with different headers and request options

## Troubleshooting

If you encounter issues:

1. **Binary download fails**: Check your internet connection
2. **Permission errors**: Make sure the binary has execute permissions (handled automatically)
3. **Module not found**: Run `npm run build` to build the project
4. **Network errors**: Verify your internet connection and firewall settings

