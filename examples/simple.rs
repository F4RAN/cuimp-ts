use cuimp::{get, post};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Simple GET Request ===");
    let response = get("https://httpbin.org/headers").await?;
    println!("Status: {}", response.status);
    println!("Data: {}", response.data);

    println!("\n=== Simple POST Request ===");
    let data = json!({
        "name": "John Doe",
        "email": "john@example.com"
    });
    let response = post("https://httpbin.org/post", Some(data)).await?;
    println!("Status: {}", response.status);
    println!("Data: {}", response.data);

    Ok(())
}
