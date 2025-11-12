use thiserror::Error;

#[derive(Error, Debug)]
pub enum CuimpError {
    #[error("Binary not found: {0}")]
    BinaryNotFound(String),

    #[error("Binary not executable: {0}")]
    BinaryNotExecutable(String),

    #[error("Download failed: {0}")]
    DownloadFailed(String),

    #[error("Extraction failed: {0}")]
    ExtractionFailed(String),

    #[error("Invalid descriptor: {0}")]
    InvalidDescriptor(String),

    #[error("Unsupported browser: {0}")]
    UnsupportedBrowser(String),

    #[error("Unsupported platform: {0}")]
    UnsupportedPlatform(String),

    #[error("Unsupported architecture: {0}")]
    UnsupportedArchitecture(String),

    #[error("Request failed: {0}")]
    RequestFailed(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    HttpError(String),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Other error: {0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, CuimpError>;
