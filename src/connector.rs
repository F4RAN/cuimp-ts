use crate::error::{CuimpError, Result};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
}

pub async fn get_latest_release() -> Result<String> {
    let url = "https://api.github.com/repos/lexiforest/curl-impersonate/releases/latest";

    let client = reqwest::Client::builder()
        .user_agent("cuimp-rs")
        .build()
        .map_err(|e| CuimpError::HttpError(e.to_string()))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| CuimpError::HttpError(e.to_string()))?;

    if !response.status().is_success() {
        return Err(CuimpError::HttpError(format!(
            "GitHub API error: {}",
            response.status()
        )));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| CuimpError::ParseError(e.to_string()))?;

    Ok(release.tag_name)
}
