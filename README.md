# Cuimp-rs

A Rust wrapper for [curl-impersonate](https://github.com/lwthiker/curl-impersonate) that allows you to make HTTP requests that mimic real browser behavior, bypassing many anti-bot protections.

## Features

- 🚀 **Browser Impersonation**: Mimic Chrome, Firefox, Safari, and Edge browsers
- 🔧 **Easy to Use**: Simple API similar to reqwest/hyper
- 📦 **Zero Runtime Dependencies**: Only requires `tar` extraction during setup
- 🎯 **Full Type Safety**: Complete type definitions with Rust's type system
- 🔄 **Auto Binary Management**: Automatically downloads and manages curl-impersonate binaries
- 🌐 **Cross-Platform**: Works on Linux, macOS, and Windows
- 🔒 **Proxy Support**: Built-in support for HTTP, HTTPS, and SOCKS proxies with authentication
- 📁 **Clean Installation**: Binaries stored in `~/.cuimp/binaries/`, not your project directory
- ⚡ **Async/Await**: Built with Tokio for high-performance async operations

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
cuimp = "0.1"
tokio = { version = "1", features = ["full"] }
```

## Quick Start

```rust
use cuimp::{get, post};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Simple GET request
    let response = get("https://httpbin.org/headers").await?;
    println!("Response: {:?}", response.data);

    // POST with data
    let data = json!({
        "name": "John Doe",
        "email": "john@example.com"
    });
    let response = post("https://httpbin.org/post", Some(data)).await?;
    println!("Response: {:?}", response.data);

    Ok(())
}
```

## Using HTTP Client

```rust
use cuimp::{CuimpHttp, CuimpDescriptor, CuimpOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let descriptor = CuimpDescriptor {
        browser: Some("chrome".to_string()),
        version: Some("123".to_string()),
        ..Default::default()
    };

    let options = CuimpOptions {
        descriptor: Some(descriptor),
        ..Default::default()
    };

    let mut client = CuimpHttp::new(options)?;
    let response: cuimp::CuimpResponse<serde_json::Value> =
        client.get("https://api.example.com/users").await?;

    println!("Status: {}", response.status);
    println!("Data: {}", response.data);

    Ok(())
}
```

## Project Usage Examples

### Web Scraping with Browser Impersonation

```rust
use cuimp::{CuimpHttp, CuimpDescriptor, CuimpOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create a client that mimics Chrome 123
    let descriptor = CuimpDescriptor {
        browser: Some("chrome".to_string()),
        version: Some("123".to_string()),
        ..Default::default()
    };

    let mut scraper = CuimpHttp::new(CuimpOptions {
        descriptor: Some(descriptor),
        ..Default::default()
    })?;

    // Scrape a website that blocks regular requests
    let response: cuimp::CuimpResponse<serde_json::Value> =
        scraper.get("https://example.com/protected-content").await?;

    println!("Scraped content: {}", response.data);

    Ok(())
}
```

### API Testing with Different Browsers

```rust
use cuimp::{CuimpHttp, CuimpDescriptor, CuimpOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let browsers = vec!["chrome", "firefox", "safari", "edge"];

    for browser in browsers {
        let descriptor = CuimpDescriptor {
            browser: Some(browser.to_string()),
            version: Some("latest".to_string()),
            ..Default::default()
        };

        let mut client = CuimpHttp::new(CuimpOptions {
            descriptor: Some(descriptor),
            ..Default::default()
        })?;

        let response: cuimp::CuimpResponse<serde_json::Value> =
            client.get("https://your-api.com/test").await?;

        println!("{}: {}", browser, response.status);
    }

    Ok(())
}
```

### Using with Proxies

```rust
use cuimp::{CuimpHttp, CuimpOptions, CuimpRequestConfig};
use serde_json::Value;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = CuimpHttp::new(CuimpOptions::default())?;

    // HTTP proxy
    let config = CuimpRequestConfig {
        url: Some("https://httpbin.org/ip".to_string()),
        proxy: Some("http://proxy.example.com:8080".to_string()),
        ..Default::default()
    };
    let response: cuimp::CuimpResponse<Value> = client.request(config).await?;

    // SOCKS5 proxy with authentication
    let config = CuimpRequestConfig {
        url: Some("https://httpbin.org/ip".to_string()),
        proxy: Some("socks5://user:pass@proxy.example.com:1080".to_string()),
        ..Default::default()
    };
    let response: cuimp::CuimpResponse<Value> = client.request(config).await?;

    // Automatic proxy detection from environment variables
    // HTTP_PROXY, HTTPS_PROXY, ALL_PROXY
    let config = CuimpRequestConfig {
        url: Some("https://httpbin.org/ip".to_string()),
        // Will automatically use HTTP_PROXY if set
        ..Default::default()
    };
    let response: cuimp::CuimpResponse<Value> = client.request(config).await?;

    Ok(())
}
```

### Pre-downloading Binaries

```rust
use cuimp::{Cuimp, CuimpDescriptor, CuimpOptions, download_binary};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Method 1: Using Cuimp struct
    let descriptor = CuimpDescriptor {
        browser: Some("chrome".to_string()),
        ..Default::default()
    };

    let cuimp = Cuimp::new(CuimpOptions {
        descriptor: Some(descriptor),
        ..Default::default()
    })?;

    let binary_info = cuimp.download().await?;
    println!("Downloaded: {}", binary_info.binary_path);

    // Method 2: Using convenience function
    let descriptor = CuimpDescriptor {
        browser: Some("firefox".to_string()),
        version: Some("133".to_string()),
        ..Default::default()
    };

    let info = download_binary(Some(CuimpOptions {
        descriptor: Some(descriptor),
        ..Default::default()
    })).await?;

    // Pre-download multiple browsers for offline use
    let browsers = vec!["chrome", "firefox", "safari", "edge"];
    for browser in browsers {
        let descriptor = CuimpDescriptor {
            browser: Some(browser.to_string()),
            ..Default::default()
        };
        let info = download_binary(Some(CuimpOptions {
            descriptor: Some(descriptor),
            ..Default::default()
        })).await?;
        println!("{} binary ready", browser);
    }

    Ok(())
}
```

## API Reference

### Convenience Functions

#### `get(url: &str) -> Result<CuimpResponse<Value>>`
Make a GET request.

#### `post(url: &str, data: Option<Value>) -> Result<CuimpResponse<Value>>`
Make a POST request.

#### `put(url: &str, data: Option<Value>) -> Result<CuimpResponse<Value>>`
Make a PUT request.

#### `patch(url: &str, data: Option<Value>) -> Result<CuimpResponse<Value>>`
Make a PATCH request.

#### `delete(url: &str) -> Result<CuimpResponse<Value>>`
Make a DELETE request.

#### `head(url: &str) -> Result<CuimpResponse<Value>>`
Make a HEAD request.

#### `options(url: &str) -> Result<CuimpResponse<Value>>`
Make an OPTIONS request.

#### `download_binary(options: Option<CuimpOptions>) -> Result<BinaryInfo>`
Download curl-impersonate binary without making HTTP requests.

### HTTP Client

#### `CuimpHttp::new(options: CuimpOptions) -> Result<CuimpHttp>`
Create an HTTP client instance.

```rust
let descriptor = CuimpDescriptor {
    browser: Some("chrome".to_string()),
    version: Some("123".to_string()),
    ..Default::default()
};

let client = CuimpHttp::new(CuimpOptions {
    descriptor: Some(descriptor),
    path: Some("/custom/path/to/binary".to_string()),
    ..Default::default()
})?;
```

#### `request<T>(config: CuimpRequestConfig) -> Result<CuimpResponse<T>>`
Make a request with full configuration.

```rust
let config = CuimpRequestConfig {
    url: Some("https://api.example.com/users".to_string()),
    method: Some(Method::POST),
    headers: Some(headers),
    data: Some(json!({"name": "John Doe"})),
    timeout: Some(5000),
    ..Default::default()
};
let response: CuimpResponse<Value> = client.request(config).await?;
```

### Core Struct

#### `Cuimp`
The core struct for managing curl-impersonate binaries and descriptors.

```rust
use cuimp::{Cuimp, CuimpDescriptor, CuimpOptions};

let descriptor = CuimpDescriptor {
    browser: Some("chrome".to_string()),
    version: Some("123".to_string()),
    ..Default::default()
};

let mut cuimp = Cuimp::new(CuimpOptions {
    descriptor: Some(descriptor),
    path: Some("/custom/path".to_string()),
    ..Default::default()
})?;

// Verify binary
let info = cuimp.verify_binary().await?;

// Build command preview
let command = cuimp.build_command_preview("https://example.com", "GET").await?;

// Download binary without verification
let binary_info = cuimp.download().await?;
```

## Configuration

### CuimpDescriptor

Configure which browser to impersonate:

```rust
pub struct CuimpDescriptor {
    pub browser: Option<String>,      // 'chrome', 'firefox', 'edge', 'safari'
    pub version: Option<String>,      // e.g., '123', '124'
    pub architecture: Option<String>, // 'x64', 'arm64'
    pub platform: Option<String>,     // 'linux', 'windows', 'macos'
}
```

### CuimpRequestConfig

Request configuration options:

```rust
pub struct CuimpRequestConfig {
    pub url: Option<String>,
    pub method: Option<Method>,
    pub base_url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub params: Option<HashMap<String, String>>,
    pub data: Option<Value>,
    pub timeout: Option<u64>,
    pub max_redirects: Option<u32>,
    pub proxy: Option<String>,
    pub insecure_tls: Option<bool>,
    pub extra_curl_args: Option<Vec<String>>,
}
```

### CuimpOptions

Core options:

```rust
pub struct CuimpOptions {
    pub descriptor: Option<CuimpDescriptor>,
    pub path: Option<String>,
    pub extra_curl_args: Option<Vec<String>>,
}
```

## Supported Browsers

| Browser | Versions | Platforms |
|---------|----------|-----------|
| Chrome  | 99, 100, 101, 104, 107, 110, 116, 119, 120, 123, 124, 131, 133a, 136 | Linux, Windows, macOS, Android |
| Firefox | 133, 135 | Linux, Windows, macOS |
| Edge    | 99, 101 | Linux, Windows, macOS |
| Safari  | 153, 155, 170, 172, 180, 184, 260 | macOS, iOS |

## Response Format

All HTTP methods return a standardized response:

```rust
pub struct CuimpResponse<T> {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub data: T,
    pub raw_body: Vec<u8>,
    pub request: RequestInfo,
}

pub struct RequestInfo {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub command: String,
}
```

## Binary Management

Cuimp automatically manages curl-impersonate binaries:

1. **Automatic Download**: Downloads the appropriate binary for your platform on first use
2. **Force Download**: Always downloads fresh binaries to ensure consistency
3. **Verification**: Checks binary integrity and permissions
4. **Clean Storage**: Binaries are stored in `~/.cuimp/binaries/` (not in your project directory)
5. **Cross-Platform**: Automatically detects your platform and architecture

### Binary Storage Location

- **Default**: `~/.cuimp/binaries/`
- **Fallback**: `./binaries/` (if home directory is not accessible)
- **No Project Pollution**: Your project directory stays clean

### Supported Proxy Formats

```rust
// HTTP proxy
proxy: Some("http://proxy.example.com:8080".to_string())

// HTTPS proxy
proxy: Some("https://proxy.example.com:8080".to_string())

// SOCKS4 proxy
proxy: Some("socks4://proxy.example.com:1080".to_string())

// SOCKS5 proxy
proxy: Some("socks5://proxy.example.com:1080".to_string())

// Proxy with authentication
proxy: Some("http://username:password@proxy.example.com:8080".to_string())
proxy: Some("socks5://username:password@proxy.example.com:1080".to_string())

// Automatic from environment variables
// HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, http_proxy, https_proxy, all_proxy
```

## Environment Variables

Cuimp automatically detects and uses these proxy environment variables:

```bash
# Set proxy for all requests
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8080
export ALL_PROXY=socks5://proxy.example.com:1080

# Or use lowercase variants
export http_proxy=http://proxy.example.com:8080
export https_proxy=https://proxy.example.com:8080
export all_proxy=socks5://proxy.example.com:1080
```

## Requirements

- Rust >= 1.70
- Tokio runtime
- Internet connection (for binary download)

## Examples

Run the examples:

```bash
# Simple GET/POST example
cargo run --example simple

# HTTP client with custom browser
cargo run --example client

# Proxy usage example
cargo run --example proxy
```

## Troubleshooting

### Common Issues

**Q: Binary download fails**
```bash
# Check your internet connection and try again
# The binary will be downloaded to ~/.cuimp/binaries/
```

**Q: Proxy not working**
```rust
// Make sure your proxy URL is correct
let config = CuimpRequestConfig {
    url: Some("https://httpbin.org/ip".to_string()),
    proxy: Some("http://username:password@proxy.example.com:8080".to_string()),
    ..Default::default()
};

// Or set environment variables
std::env::set_var("HTTP_PROXY", "http://proxy.example.com:8080");
```

**Q: Permission denied errors**
```bash
# On Unix systems, make sure the binary has execute permissions
chmod +x ~/.cuimp/binaries/curl-impersonate
```

**Q: Binary not found**
```bash
# Force re-download by clearing the binaries directory
rm -rf ~/.cuimp/binaries/
# Then run your code again - it will re-download
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [GitHub Repository](https://github.com/F4RAN/cuimp-rs)
- [curl-impersonate](https://github.com/lexiforest/curl-impersonate)
- [TypeScript Version](https://github.com/F4RAN/cuimp-ts)

## Contributors

- [@F4RAN](https://github.com/F4RAN) - Original author and maintainer
