use crate::cuimp::Cuimp;
use crate::error::{CuimpError, Result};
use crate::runner::run_binary;
use crate::types::{
    CuimpOptions, CuimpRequestConfig, CuimpResponse, Method, RequestInfo,
};
use serde_json::Value;
use std::collections::HashMap;
use url::Url;

/// HTTP client for making requests with curl-impersonate
#[derive(Debug)]
pub struct CuimpHttp {
    core: Cuimp,
    defaults: CuimpRequestConfig,
}

impl CuimpHttp {
    /// Create a new HTTP client
    pub fn new(options: CuimpOptions) -> Result<Self> {
        let core = Cuimp::new(options.clone())?;
        let defaults = CuimpRequestConfig {
            extra_curl_args: options.extra_curl_args,
            ..Default::default()
        };

        Ok(CuimpHttp { core, defaults })
    }

    /// Make an HTTP request
    pub async fn request<T>(&mut self, config: CuimpRequestConfig) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        let method = config.method.unwrap_or(Method::GET);

        // Build URL
        let url_base = config.base_url.as_ref().or(self.defaults.base_url.as_ref());
        let raw_url = config
            .url
            .as_ref()
            .ok_or_else(|| CuimpError::InvalidUrl("URL is required".to_string()))?;

        let mut url = if let Some(base) = url_base {
            join_url(base, raw_url)?
        } else {
            raw_url.clone()
        };

        // Add query parameters
        if let Some(params) = config.params.as_ref().or(self.defaults.params.as_ref()) {
            url = encode_params(&url, params)?;
        }

        // Get binary path
        let bin = self.core.ensure_path().await?;

        // Merge headers
        let mut headers = HashMap::new();
        if let Some(default_headers) = &self.defaults.headers {
            headers.extend(default_headers.clone());
        }
        if let Some(config_headers) = &config.headers {
            headers.extend(config_headers.clone());
        }

        // Build curl arguments
        let mut args: Vec<String> = Vec::new();

        // Method
        if method != Method::GET {
            args.push("-X".to_string());
            args.push(method.to_string());
        }

        // Redirects
        let max_redirects = config
            .max_redirects
            .or(self.defaults.max_redirects)
            .unwrap_or(10);
        if max_redirects > 0 {
            args.push("--location".to_string());
            args.push("--max-redirs".to_string());
            args.push(max_redirects.to_string());
        }

        // Proxy
        if let Some(proxy) = config.proxy.as_ref().or(self.defaults.proxy.as_ref()) {
            let normalized_proxy = normalize_proxy_url(proxy);
            args.push("--proxy".to_string());
            args.push(normalized_proxy);
        } else if let Some(env_proxy) = get_proxy_from_environment() {
            args.push("--proxy".to_string());
            args.push(env_proxy);
        }

        // Insecure TLS
        if config.insecure_tls.or(self.defaults.insecure_tls).unwrap_or(false) {
            args.push("-k".to_string());
        }

        // Headers
        for (key, value) in &headers {
            args.push("-H".to_string());
            args.push(format!("{}: {}", key, value));
        }

        // Body
        if let Some(data) = &config.data {
            let body = if data.is_string() {
                data.as_str().unwrap().to_string()
            } else {
                serde_json::to_string(data)?
            };

            args.push("--data-binary".to_string());
            args.push(body);

            // Add Content-Type if not present
            if !headers.iter().any(|(k, _)| k.to_lowercase() == "content-type") {
                args.push("-H".to_string());
                args.push("Content-Type: application/json".to_string());
            }
        }

        // Extra curl arguments
        if let Some(extra_args) = config.extra_curl_args.as_ref().or(self.defaults.extra_curl_args.as_ref()) {
            args.extend_from_slice(extra_args);
        }

        // Include headers in output
        args.push("-i".to_string());

        // URL
        args.push(url.clone());

        // Build command preview
        let command = format!(
            "{} {}",
            bin,
            args.iter()
                .map(|a| if a.contains(' ') {
                    format!("\"{}\"", a)
                } else {
                    a.clone()
                })
                .collect::<Vec<_>>()
                .join(" ")
        );

        // Execute
        let timeout_ms = config.timeout.or(self.defaults.timeout);
        let result = run_binary(&bin, &args, timeout_ms).await?;

        // Parse response
        parse_response(&result.stdout, &url, &method, &headers, &command)
    }

    /// GET request
    pub async fn get<T>(&mut self, url: &str) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::GET),
            ..Default::default()
        })
        .await
    }

    /// POST request
    pub async fn post<T>(&mut self, url: &str, data: Option<Value>) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::POST),
            data,
            ..Default::default()
        })
        .await
    }

    /// PUT request
    pub async fn put<T>(&mut self, url: &str, data: Option<Value>) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::PUT),
            data,
            ..Default::default()
        })
        .await
    }

    /// PATCH request
    pub async fn patch<T>(&mut self, url: &str, data: Option<Value>) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::PATCH),
            data,
            ..Default::default()
        })
        .await
    }

    /// DELETE request
    pub async fn delete<T>(&mut self, url: &str) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::DELETE),
            ..Default::default()
        })
        .await
    }

    /// HEAD request
    pub async fn head<T>(&mut self, url: &str) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::HEAD),
            ..Default::default()
        })
        .await
    }

    /// OPTIONS request
    pub async fn options<T>(&mut self, url: &str) -> Result<CuimpResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        self.request(CuimpRequestConfig {
            url: Some(url.to_string()),
            method: Some(Method::OPTIONS),
            ..Default::default()
        })
        .await
    }
}

/// Join base URL with path
fn join_url(base: &str, path: &str) -> Result<String> {
    let base_url = Url::parse(base).map_err(|e| CuimpError::InvalidUrl(e.to_string()))?;
    let joined = base_url
        .join(path)
        .map_err(|e| CuimpError::InvalidUrl(e.to_string()))?;
    Ok(joined.to_string())
}

/// Encode query parameters
fn encode_params(url: &str, params: &HashMap<String, String>) -> Result<String> {
    let mut url = Url::parse(url).map_err(|e| CuimpError::InvalidUrl(e.to_string()))?;

    for (key, value) in params {
        url.query_pairs_mut().append_pair(key, value);
    }

    Ok(url.to_string())
}

/// Normalize proxy URL
fn normalize_proxy_url(proxy: &str) -> String {
    if proxy.contains("://") {
        return proxy.to_string();
    }

    if proxy.starts_with("socks4://") || proxy.starts_with("socks5://") {
        return proxy.to_string();
    }

    // Default to HTTP proxy
    if proxy.contains('@') {
        format!("http://{}", proxy)
    } else {
        format!("http://{}", proxy)
    }
}

/// Get proxy from environment variables
fn get_proxy_from_environment() -> Option<String> {
    let proxy_vars = [
        "HTTP_PROXY",
        "http_proxy",
        "HTTPS_PROXY",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
    ];

    for var in &proxy_vars {
        if let Ok(value) = std::env::var(var) {
            return Some(value);
        }
    }

    None
}

/// Parse HTTP response from curl output
fn parse_response<T>(
    stdout: &[u8],
    url: &str,
    method: &Method,
    headers: &HashMap<String, String>,
    command: &str,
) -> Result<CuimpResponse<T>>
where
    T: serde::de::DeserializeOwned,
{
    // Find all HTTP/ markers
    let http_marker = b"HTTP/";
    let mut http_starts = Vec::new();

    for i in 0..=stdout.len().saturating_sub(5) {
        if &stdout[i..i + 5] == http_marker {
            http_starts.push(i);
        }
    }

    if http_starts.is_empty() {
        let preview = String::from_utf8_lossy(&stdout[..stdout.len().min(500)]);
        return Err(CuimpError::InvalidResponse(format!(
            "No HTTP response found:\n{}",
            preview
        )));
    }

    // Find the end of the last header block
    let separator1 = b"\r\n\r\n";
    let separator2 = b"\n\n";
    let mut last_header_end = 0;
    let mut last_header_end_length = 0;

    for &http_start in &http_starts {
        // Search for separator starting from this HTTP block
        for i in http_start..stdout.len() {
            if i + 4 <= stdout.len() && &stdout[i..i + 4] == separator1 {
                last_header_end = i;
                last_header_end_length = 4;
                break;
            } else if i + 2 <= stdout.len() && &stdout[i..i + 2] == separator2 {
                last_header_end = i;
                last_header_end_length = 2;
                break;
            }
        }
    }

    // Split headers and body
    let header_bytes = &stdout[..last_header_end];
    let raw_body = &stdout[last_header_end + last_header_end_length..];

    // Decode headers
    let header_text = String::from_utf8_lossy(header_bytes);

    // Handle multiple header blocks (redirects)
    let http_blocks: Vec<&str> = header_text.split("HTTP/").collect();
    let valid_blocks: Vec<&str> = http_blocks
        .into_iter()
        .filter(|block| !block.trim().is_empty() && block.trim().starts_with(|c: char| c.is_ascii_digit()))
        .collect();

    let last_block = if !valid_blocks.is_empty() {
        format!("HTTP/{}", valid_blocks[valid_blocks.len() - 1])
    } else {
        header_text.to_string()
    };

    // Parse status line and headers
    let lines: Vec<&str> = last_block.lines().collect();
    let status_line = lines.first().unwrap_or(&"HTTP/1.1 200 OK");

    let status_parts: Vec<&str> = status_line.split_whitespace().collect();
    let status = if status_parts.len() >= 2 {
        status_parts[1].parse().unwrap_or(200)
    } else {
        200
    };
    let status_text = if status_parts.len() >= 3 {
        status_parts[2..].join(" ")
    } else {
        "OK".to_string()
    };

    let mut resp_headers = HashMap::new();
    for line in lines.iter().skip(1) {
        if let Some(idx) = line.find(':') {
            let key = line[..idx].trim().to_string();
            let value = line[idx + 1..].trim().to_string();
            resp_headers.insert(key, value);
        }
    }

    // Try to parse body
    let data = try_parse_body(raw_body, &resp_headers)?;

    Ok(CuimpResponse {
        status,
        status_text,
        headers: resp_headers,
        data,
        raw_body: raw_body.to_vec(),
        request: RequestInfo {
            url: url.to_string(),
            method: method.to_string(),
            headers: headers.clone(),
            command: command.to_string(),
        },
    })
}

/// Try to parse response body
fn try_parse_body<T>(body: &[u8], headers: &HashMap<String, String>) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    // Check content-type
    let content_type = headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "content-type")
        .map(|(_, v)| v.to_lowercase())
        .unwrap_or_default();

    if content_type.contains("application/json") {
        // Try to parse as JSON
        let text = String::from_utf8_lossy(body);
        serde_json::from_str(&text).map_err(|e| CuimpError::JsonError(e))
    } else {
        // Try to parse as JSON anyway, fallback to text
        let text = String::from_utf8_lossy(body);
        serde_json::from_str(&text).or_else(|_| {
            // If T is Value, wrap text as string
            serde_json::from_value(Value::String(text.to_string()))
                .map_err(|e| CuimpError::JsonError(e))
        })
    }
}
