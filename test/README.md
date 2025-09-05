# Test Suite

This directory contains comprehensive tests for the cuimp library.

## Test Structure

```
test/
├── unit/                    # Unit tests for individual components
│   ├── cuimp.test.ts       # Tests for Cuimp core class
│   ├── client.test.ts      # Tests for CuimpHttp client
│   ├── runner.test.ts      # Tests for runBinary utility
│   ├── parser.test.ts      # Tests for parser utilities
│   └── descriptorValidation.test.ts # Tests for validation functions
├── integration/            # Integration tests
│   └── index.test.ts       # Tests for main API surface
└── README.md              # This file
```

## Running Tests

```bash
# Run all tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Coverage

The test suite covers:

### Unit Tests
- **Cuimp Class**: Binary verification, command building, descriptor management
- **CuimpHttp Class**: HTTP request methods, response parsing, configuration handling
- **Runner Utility**: Process execution, timeout handling, signal handling
- **Parser Utility**: Descriptor parsing, binary discovery, download logic
- **Validation**: Input validation for descriptors and configuration

### Integration Tests
- **Main API**: End-to-end testing of the public API
- **Error Handling**: Network errors, malformed responses, binary issues
- **Type Safety**: TypeScript type checking across the API
- **Real-world Scenarios**: Authentication, file uploads, form submissions

## Mocking Strategy

Tests use comprehensive mocking to isolate units under test:

- **File System**: Mocked `fs` module for binary existence checks
- **Child Process**: Mocked `spawn` for process execution
- **Network**: Mocked HTTP responses and downloads
- **External Dependencies**: Mocked parser and validation modules

## Test Data

Tests use realistic test data including:
- Valid HTTP responses with headers and bodies
- Various error conditions and edge cases
- Different browser/platform/architecture combinations
- Real-world API scenarios

## Contributing

When adding new features:

1. Add unit tests for new functions/classes
2. Add integration tests for new API endpoints
3. Update this README if adding new test categories
4. Ensure all tests pass before submitting PRs
