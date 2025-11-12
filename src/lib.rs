//! Cuimp - Rust wrapper for curl-impersonate
//!
//! A Rust library that provides browser impersonation capabilities using curl-impersonate,
//! allowing you to make HTTP requests that mimic real browser behavior.
//!
//! # Features
//!
//! - Browser impersonation (Chrome, Firefox, Safari, Edge)
//! - Full HTTP client with all standard methods
//! - Proxy support (HTTP, HTTPS, SOCKS)
//! - Automatic binary management and downloading
//! - Cross-platform support (Linux, macOS, Windows)
//!
//! # Examples
//!
//! ```no_run
//! use cuimp::{get, post, CuimpHttp, Cuimp, CuimpDescriptor};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Simple GET request
//!     let response = get("https://httpbin.org/headers").await?;
//!     println!("Response: {:?}", response.data);
//!
//!     // POST with data
//!     let data = serde_json::json!({
//!         "name": "John Doe",
//!         "email": "john@example.com"
//!     });
//!     let response = post("https://httpbin.org/post", Some(data)).await?;
//!
//!     // Using HTTP client with custom browser
//!     let descriptor = CuimpDescriptor {
//!         browser: Some("chrome".to_string()),
//!         version: Some("123".to_string()),
//!         ..Default::default()
//!     };
//!     let client = CuimpHttp::new(descriptor)?;
//!     let response = client.get("https://api.example.com/users").await?;
//!
//!     Ok(())
//! }
//! ```

mod types;
mod cuimp;
mod client;
mod runner;
mod parser;
mod connector;
mod constants;
mod validation;
mod error;

pub use types::{
    CuimpDescriptor, BinaryInfo, Method, CuimpRequestConfig, CuimpResponse, CuimpOptions,
};
pub use cuimp::Cuimp;
pub use client::CuimpHttp;
pub use runner::run_binary;
pub use error::{CuimpError, Result};

use serde_json::Value;

/// Create a new HTTP client instance with optional configuration
pub fn create_cuimp_http(options: Option<CuimpOptions>) -> Result<CuimpHttp> {
    CuimpHttp::new(options.unwrap_or_default())
}

/// Make a GET request
pub async fn get(url: &str) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.get(url).await
}

/// Make a POST request
pub async fn post(url: &str, data: Option<Value>) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.post(url, data).await
}

/// Make a PUT request
pub async fn put(url: &str, data: Option<Value>) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.put(url, data).await
}

/// Make a PATCH request
pub async fn patch(url: &str, data: Option<Value>) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.patch(url, data).await
}

/// Make a DELETE request
pub async fn delete(url: &str) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.delete(url).await
}

/// Make a HEAD request
pub async fn head(url: &str) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.head(url).await
}

/// Make an OPTIONS request
pub async fn options(url: &str) -> Result<CuimpResponse<Value>> {
    let mut client = create_cuimp_http(None)?;
    client.options(url).await
}

/// Download curl-impersonate binary
pub async fn download_binary(options: Option<CuimpOptions>) -> Result<BinaryInfo> {
    let cuimp = Cuimp::new(options.unwrap_or_default())?;
    cuimp.download().await
}
