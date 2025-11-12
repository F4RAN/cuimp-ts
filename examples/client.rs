use cuimp::{CuimpDescriptor, CuimpHttp, CuimpOptions};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Using HTTP Client with Custom Browser ===");

    // Create a descriptor for Chrome 123
    let descriptor = CuimpDescriptor {
        browser: Some("chrome".to_string()),
        version: Some("123".to_string()),
        ..Default::default()
    };

    let options = CuimpOptions {
        descriptor: Some(descriptor),
        ..Default::default()
    };

    // Create HTTP client
    let mut client = CuimpHttp::new(options)?;

    // GET request
    println!("\n--- GET Request ---");
    let response: cuimp::CuimpResponse<serde_json::Value> =
        client.get("https://httpbin.org/headers").await?;
    println!("Status: {}", response.status);
    println!("Headers: {:?}", response.headers);
    println!("Data: {}", response.data);

    // POST request
    println!("\n--- POST Request ---");
    let data = json!({
        "name": "Jane Doe",
        "email": "jane@example.com"
    });
    let response: cuimp::CuimpResponse<serde_json::Value> =
        client.post("https://httpbin.org/post", Some(data)).await?;
    println!("Status: {}", response.status);
    println!("Data: {}", response.data);

    Ok(())
}
