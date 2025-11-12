use cuimp::{CuimpHttp, CuimpOptions, CuimpRequestConfig};
use serde_json::Value;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Using Proxy ===");

    let mut client = CuimpHttp::new(CuimpOptions::default())?;

    // Using HTTP proxy
    println!("\n--- Request with HTTP Proxy ---");
    let config = CuimpRequestConfig {
        url: Some("https://httpbin.org/ip".to_string()),
        proxy: Some("http://proxy.example.com:8080".to_string()),
        ..Default::default()
    };

    // This will fail if the proxy doesn't exist, but demonstrates the usage
    match client.request::<Value>(config).await {
        Ok(response) => {
            println!("Status: {}", response.status);
            println!("Data: {}", response.data);
        }
        Err(e) => {
            println!("Request failed (expected if proxy doesn't exist): {}", e);
        }
    }

    // Using SOCKS5 proxy with authentication
    println!("\n--- Request with SOCKS5 Proxy (with auth) ---");
    let config = CuimpRequestConfig {
        url: Some("https://httpbin.org/ip".to_string()),
        proxy: Some("socks5://user:pass@proxy.example.com:1080".to_string()),
        ..Default::default()
    };

    match client.request::<Value>(config).await {
        Ok(response) => {
            println!("Status: {}", response.status);
            println!("Data: {}", response.data);
        }
        Err(e) => {
            println!("Request failed (expected if proxy doesn't exist): {}", e);
        }
    }

    // Using environment variable proxy
    println!("\n--- Using Environment Variable Proxy ---");
    println!("Set HTTP_PROXY environment variable to use automatic proxy detection");
    std::env::set_var("HTTP_PROXY", "http://proxy.example.com:8080");

    let config = CuimpRequestConfig {
        url: Some("https://httpbin.org/ip".to_string()),
        // No proxy specified, will use HTTP_PROXY from environment
        ..Default::default()
    };

    match client.request::<Value>(config).await {
        Ok(response) => {
            println!("Status: {}", response.status);
            println!("Data: {}", response.data);
        }
        Err(e) => {
            println!("Request failed (expected if proxy doesn't exist): {}", e);
        }
    }

    Ok(())
}
