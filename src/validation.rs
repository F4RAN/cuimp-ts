use crate::constants::{ARCHITECTURE_LIST, BROWSER_LIST, PLATFORM_LIST};
use crate::error::{CuimpError, Result};
use crate::types::CuimpDescriptor;

pub fn validate_descriptor(descriptor: &CuimpDescriptor) -> Result<()> {
    // Validate browser if provided
    if let Some(browser) = &descriptor.browser {
        if !BROWSER_LIST.contains(&browser.as_str()) {
            return Err(CuimpError::UnsupportedBrowser(format!(
                "{}. Supported browsers: {}",
                browser,
                BROWSER_LIST.join(", ")
            )));
        }
    }

    // Validate architecture if provided
    if let Some(architecture) = &descriptor.architecture {
        if !ARCHITECTURE_LIST.contains(&architecture.as_str()) {
            return Err(CuimpError::UnsupportedArchitecture(format!(
                "{}. Supported architectures: {}",
                architecture,
                ARCHITECTURE_LIST.join(", ")
            )));
        }
    }

    // Validate platform if provided
    if let Some(platform) = &descriptor.platform {
        if !PLATFORM_LIST.contains(&platform.as_str()) {
            return Err(CuimpError::UnsupportedPlatform(format!(
                "{}. Supported platforms: {}",
                platform,
                PLATFORM_LIST.join(", ")
            )));
        }
    }

    Ok(())
}
