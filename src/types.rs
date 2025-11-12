use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Browser descriptor for impersonation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CuimpDescriptor {
    pub browser: Option<String>,
    pub version: Option<String>,
    pub architecture: Option<String>,
    pub platform: Option<String>,
}

/// Information about the curl-impersonate binary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryInfo {
    pub binary_path: String,
    pub is_downloaded: bool,
    pub version: Option<String>,
}

/// HTTP methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Method {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    HEAD,
    OPTIONS,
}

impl Method {
    pub fn as_str(&self) -> &str {
        match self {
            Method::GET => "GET",
            Method::POST => "POST",
            Method::PUT => "PUT",
            Method::PATCH => "PATCH",
            Method::DELETE => "DELETE",
            Method::HEAD => "HEAD",
            Method::OPTIONS => "OPTIONS",
        }
    }
}

impl std::fmt::Display for Method {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// HTTP request configuration
#[derive(Debug, Clone, Default)]
pub struct CuimpRequestConfig {
    pub url: Option<String>,
    pub method: Option<Method>,
    pub base_url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub params: Option<HashMap<String, String>>,
    pub data: Option<serde_json::Value>,
    pub timeout: Option<u64>,
    pub max_redirects: Option<u32>,
    pub proxy: Option<String>,
    pub insecure_tls: Option<bool>,
    pub extra_curl_args: Option<Vec<String>>,
}

/// HTTP response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuimpResponse<T> {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub data: T,
    pub raw_body: Vec<u8>,
    pub request: RequestInfo,
}

/// Request information included in the response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestInfo {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub command: String,
}

/// Options for creating a Cuimp instance
#[derive(Debug, Clone, Default)]
pub struct CuimpOptions {
    pub descriptor: Option<CuimpDescriptor>,
    pub path: Option<String>,
    pub extra_curl_args: Option<Vec<String>>,
}

impl From<CuimpDescriptor> for CuimpOptions {
    fn from(descriptor: CuimpDescriptor) -> Self {
        CuimpOptions {
            descriptor: Some(descriptor),
            ..Default::default()
        }
    }
}
