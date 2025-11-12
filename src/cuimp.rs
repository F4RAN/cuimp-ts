use crate::error::{CuimpError, Result};
use crate::parser::parse_descriptor;
use crate::types::{BinaryInfo, CuimpDescriptor, CuimpOptions};
use crate::validation::validate_descriptor;
use std::path::Path;

/// Core Cuimp struct for managing curl-impersonate binaries
#[derive(Debug, Clone)]
pub struct Cuimp {
    descriptor: CuimpDescriptor,
    path: Option<String>,
    binary_info: Option<BinaryInfo>,
}

impl Cuimp {
    /// Create a new Cuimp instance
    pub fn new(options: CuimpOptions) -> Result<Self> {
        let descriptor = options.descriptor.unwrap_or_default();

        // Validate descriptor if provided
        if descriptor.browser.is_some()
            || descriptor.version.is_some()
            || descriptor.architecture.is_some()
            || descriptor.platform.is_some()
        {
            validate_descriptor(&descriptor)?;
        }

        Ok(Cuimp {
            descriptor,
            path: options.path,
            binary_info: None,
        })
    }

    /// Verify binary is present and executable
    pub async fn verify_binary(&mut self) -> Result<String> {
        // If path is already set and valid, return it
        if let Some(path) = &self.path {
            if self.is_binary_executable(path) {
                return Ok(path.clone());
            }
        }

        // Parse descriptor to get binary info
        self.binary_info = Some(parse_descriptor(&self.descriptor).await?);

        let binary_path = self
            .binary_info
            .as_ref()
            .and_then(|info| Some(info.binary_path.clone()))
            .ok_or_else(|| CuimpError::BinaryNotFound("Binary path not found".to_string()))?;

        // Verify the binary is executable
        if !self.is_binary_executable(&binary_path) {
            return Err(CuimpError::BinaryNotExecutable(binary_path));
        }

        // Update the path
        self.path = Some(binary_path.clone());

        println!("Binary verified: {}", binary_path);
        if let Some(info) = &self.binary_info {
            if info.is_downloaded {
                println!(
                    "Binary downloaded successfully (version: {})",
                    info.version.as_deref().unwrap_or("unknown")
                );
            }
        }

        Ok(binary_path)
    }

    /// Check if binary is executable
    fn is_binary_executable(&self, binary_path: &str) -> bool {
        let path = Path::new(binary_path);

        if !path.exists() || !path.is_file() {
            return false;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(path) {
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

    /// Build a command preview
    pub async fn build_command_preview(&mut self, url: &str, method: &str) -> Result<String> {
        let binary_path = self.verify_binary().await?;

        if url.is_empty() {
            return Err(CuimpError::InvalidUrl("URL must be non-empty".to_string()));
        }

        if method.is_empty() {
            return Err(CuimpError::Other("Method must be non-empty".to_string()));
        }

        let command = format!("{} -X {} \"{}\"", binary_path, method.to_uppercase(), url);
        println!("Command preview: {}", command);
        Ok(command)
    }

    /// Get the current binary path
    pub fn get_binary_path(&self) -> Option<&str> {
        self.path.as_deref()
    }

    /// Get the current descriptor
    pub fn get_descriptor(&self) -> &CuimpDescriptor {
        &self.descriptor
    }

    /// Get binary information if available
    pub fn get_binary_info(&self) -> Option<&BinaryInfo> {
        self.binary_info.as_ref()
    }

    /// Update the descriptor
    pub fn set_descriptor(&mut self, descriptor: CuimpDescriptor) -> Result<()> {
        validate_descriptor(&descriptor)?;
        self.descriptor = descriptor;
        self.path = None;
        self.binary_info = None;
        Ok(())
    }

    /// Set a custom binary path
    pub fn set_binary_path(&mut self, path: String) {
        self.path = Some(path);
        self.binary_info = None;
    }

    /// Ensure binary path is available (convenience method)
    pub async fn ensure_path(&mut self) -> Result<String> {
        self.verify_binary().await
    }

    /// Download binary without verifying
    pub async fn download(mut self) -> Result<BinaryInfo> {
        // Validate descriptor if provided
        if self.descriptor.browser.is_some()
            || self.descriptor.version.is_some()
            || self.descriptor.architecture.is_some()
            || self.descriptor.platform.is_some()
        {
            validate_descriptor(&self.descriptor)?;
        }

        // Parse descriptor to download binary
        self.binary_info = Some(parse_descriptor(&self.descriptor).await?);

        let binary_info = self
            .binary_info
            .ok_or_else(|| CuimpError::BinaryNotFound("Binary info not available".to_string()))?;

        println!("Binary ready: {}", binary_info.binary_path);
        if binary_info.is_downloaded {
            println!(
                "Download completed (version: {})",
                binary_info.version.as_deref().unwrap_or("unknown")
            );
        } else {
            println!(
                "Using existing binary (version: {})",
                binary_info.version.as_deref().unwrap_or("unknown")
            );
        }

        Ok(binary_info)
    }
}

impl Default for Cuimp {
    fn default() -> Self {
        Cuimp {
            descriptor: CuimpDescriptor::default(),
            path: None,
            binary_info: None,
        }
    }
}
