use crate::connector::get_latest_release;
use crate::constants::{ARCHITECTURE_LIST, BINARY_PATTERNS, BINARY_SEARCH_PATHS, BROWSER_LIST, PLATFORM_LIST};
use crate::error::{CuimpError, Result};
use crate::types::{BinaryInfo, CuimpDescriptor};
use crate::validation::validate_descriptor;
use flate2::read::GzDecoder;
use std::fs;
use std::path::{Path, PathBuf};
use tar::Archive;

/// Get system architecture and platform
pub fn get_system_info() -> Result<(String, String)> {
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => {
            return Err(CuimpError::UnsupportedArchitecture(format!(
                "Unsupported architecture: {}",
                other
            )))
        }
    };

    let platform = match std::env::consts::OS {
        "linux" => "linux",
        "windows" => "windows",
        "macos" => "macos",
        other => {
            return Err(CuimpError::UnsupportedPlatform(format!(
                "Unsupported platform: {}",
                other
            )))
        }
    };

    Ok((arch.to_string(), platform.to_string()))
}

/// Extract version number from filename
fn extract_version_number(filename: &str) -> u32 {
    filename
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .unwrap_or(0)
}

/// Get binaries directory path
fn get_binaries_dir() -> PathBuf {
    if let Some(home_dir) = dirs::home_dir() {
        home_dir.join(".cuimp").join("binaries")
    } else {
        PathBuf::from("./binaries")
    }
}

/// Check if a binary is executable
fn is_binary_executable(path: &Path) -> bool {
    if !path.exists() || !path.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(path) {
            let permissions = metadata.permissions();
            return permissions.mode() & 0o111 != 0;
        }
        false
    }

    #[cfg(not(unix))]
    {
        true
    }
}

/// Make binary executable
fn make_executable(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(path)?.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions)?;
    }
    Ok(())
}

/// Find existing binary in search paths
pub fn find_existing_binary(browser: Option<&str>) -> Option<PathBuf> {
    let binaries_dir = get_binaries_dir();
    let mut search_paths: Vec<PathBuf> = vec![binaries_dir];

    // Add system paths
    for path_str in BINARY_SEARCH_PATHS {
        search_paths.push(PathBuf::from(path_str));
    }

    // Filter patterns based on browser
    let patterns: Vec<&str> = if let Some(browser) = browser {
        BINARY_PATTERNS
            .iter()
            .filter(|&&pattern| {
                if browser == "chrome" {
                    pattern.contains("chrome") || pattern == "curl-impersonate"
                } else if browser == "firefox" {
                    pattern.contains("firefox") || pattern == "curl-impersonate"
                } else if browser == "edge" {
                    pattern.contains("edge") || pattern == "curl-impersonate"
                } else if browser == "safari" {
                    pattern.contains("safari") || pattern == "curl-impersonate"
                } else {
                    pattern == "curl-impersonate"
                }
            })
            .copied()
            .collect()
    } else {
        BINARY_PATTERNS.to_vec()
    };

    for search_path in search_paths {
        if !search_path.exists() {
            continue;
        }

        for pattern in &patterns {
            // Try exact match first
            let binary_path = search_path.join(pattern);
            if is_binary_executable(&binary_path) {
                return Some(binary_path);
            }

            // Try pattern matching for wildcards
            if pattern.contains('*') {
                if let Ok(entries) = fs::read_dir(&search_path) {
                    let mut matches: Vec<PathBuf> = entries
                        .filter_map(|entry| entry.ok())
                        .map(|entry| entry.path())
                        .filter(|path| {
                            if let Some(filename) = path.file_name() {
                                let filename_str = filename.to_string_lossy();
                                let pattern_regex = pattern.replace('*', ".*");
                                filename_str.contains(&pattern_regex.replace(".*", ""))
                            } else {
                                false
                            }
                        })
                        .filter(|path| is_binary_executable(path))
                        .collect();

                    if !matches.is_empty() {
                        // Sort by version number (highest first)
                        matches.sort_by(|a, b| {
                            let ver_a = extract_version_number(&a.to_string_lossy());
                            let ver_b = extract_version_number(&b.to_string_lossy());
                            ver_b.cmp(&ver_a)
                        });
                        return Some(matches[0].clone());
                    }
                }
            }
        }
    }

    None
}

/// Download and extract binary
pub async fn download_and_extract_binary(
    browser: &str,
    architecture: &str,
    platform: &str,
    version: &str,
) -> Result<BinaryInfo> {
    // Validate parameters
    if !BROWSER_LIST.contains(&browser) {
        return Err(CuimpError::UnsupportedBrowser(browser.to_string()));
    }
    if !ARCHITECTURE_LIST.contains(&architecture) {
        return Err(CuimpError::UnsupportedArchitecture(architecture.to_string()));
    }
    if !PLATFORM_LIST.contains(&platform) {
        return Err(CuimpError::UnsupportedPlatform(platform.to_string()));
    }

    // Get latest version
    let latest_version = get_latest_release().await?;
    let actual_version = if version == "latest" {
        latest_version.trim_start_matches('v').to_string()
    } else {
        version.trim_start_matches('v').to_string()
    };

    // Construct download URL
    let asset_name = if platform == "linux" {
        let linux_arch = if architecture == "x64" {
            "x86_64"
        } else {
            "aarch64"
        };
        format!(
            "curl-impersonate-{}.{}-linux-gnu.tar.gz",
            latest_version, linux_arch
        )
    } else {
        format!(
            "curl-impersonate-{}.{}-{}.tar.gz",
            latest_version, architecture, platform
        )
    };

    let download_url = format!(
        "https://github.com/lexiforest/curl-impersonate/releases/download/{}/{}",
        latest_version, asset_name
    );

    println!("Downloading {}...", download_url);

    // Download the file
    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| CuimpError::DownloadFailed(e.to_string()))?;

    if !response.status().is_success() {
        return Err(CuimpError::DownloadFailed(format!(
            "HTTP {}: {}",
            response.status(),
            response.status().canonical_reason().unwrap_or("Unknown")
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| CuimpError::DownloadFailed(e.to_string()))?;

    // Create binaries directory
    let binaries_dir = get_binaries_dir();
    fs::create_dir_all(&binaries_dir)?;

    // Save to temporary file
    let temp_file_path = binaries_dir.join(format!("{}-{}-{}.tar.gz", browser, architecture, platform));
    fs::write(&temp_file_path, bytes)?;

    // Extract the archive
    println!("Extracting to {:?}...", binaries_dir);
    let tar_gz = fs::File::open(&temp_file_path)?;
    let tar = GzDecoder::new(tar_gz);
    let mut archive = Archive::new(tar);
    archive
        .unpack(&binaries_dir)
        .map_err(|e| CuimpError::ExtractionFailed(e.to_string()))?;

    // Clean up temp file
    fs::remove_file(&temp_file_path)?;

    // Find the extracted binary
    let main_binary_name = "curl-impersonate";
    let binary_path = binaries_dir.join(main_binary_name);

    if !binary_path.exists() {
        // Look for browser-specific binary
        let browser_pattern = format!("curl_{}", browser);
        if let Ok(entries) = fs::read_dir(&binaries_dir) {
            let mut matches: Vec<PathBuf> = entries
                .filter_map(|entry| entry.ok())
                .map(|entry| entry.path())
                .filter(|path| {
                    if let Some(filename) = path.file_name() {
                        filename.to_string_lossy().contains(&browser_pattern)
                    } else {
                        false
                    }
                })
                .collect();

            if !matches.is_empty() {
                matches.sort_by(|a, b| {
                    let ver_a = extract_version_number(&a.to_string_lossy());
                    let ver_b = extract_version_number(&b.to_string_lossy());
                    ver_b.cmp(&ver_a)
                });
                let browser_binary_path = matches[0].clone();
                make_executable(&browser_binary_path)?;

                return Ok(BinaryInfo {
                    binary_path: browser_binary_path.to_string_lossy().to_string(),
                    is_downloaded: true,
                    version: Some(actual_version),
                });
            }
        }

        return Err(CuimpError::BinaryNotFound(format!(
            "Binary not found after extraction: {:?}",
            binary_path
        )));
    }

    // Make executable
    make_executable(&binary_path)?;

    Ok(BinaryInfo {
        binary_path: binary_path.to_string_lossy().to_string(),
        is_downloaded: true,
        version: Some(actual_version),
    })
}

/// Parse descriptor and get binary information
pub async fn parse_descriptor(descriptor: &CuimpDescriptor) -> Result<BinaryInfo> {
    // Validate descriptor
    validate_descriptor(descriptor)?;

    // Get system info
    let (architecture, platform) = get_system_info()?;
    let browser = descriptor.browser.as_deref().unwrap_or("chrome");
    let version = descriptor.version.as_deref().unwrap_or("latest");

    // First, try to find existing binary
    if let Some(existing_binary) = find_existing_binary(Some(browser)) {
        println!("Found existing binary: {:?}", existing_binary);
        let version_str = extract_version_number(&existing_binary.to_string_lossy()).to_string();
        return Ok(BinaryInfo {
            binary_path: existing_binary.to_string_lossy().to_string(),
            is_downloaded: false,
            version: if version_str != "0" {
                Some(version_str)
            } else {
                Some("unknown".to_string())
            },
        });
    }

    // If not found, download it
    println!(
        "No existing binary found. Downloading curl-impersonate for {} on {}-{}...",
        browser, platform, architecture
    );

    download_and_extract_binary(browser, &architecture, &platform, version).await
}
