pub const BROWSER_LIST: &[&str] = &["chrome", "firefox", "edge", "safari"];
pub const ARCHITECTURE_LIST: &[&str] = &["x64", "arm64"];
pub const PLATFORM_LIST: &[&str] = &["linux", "windows", "macos"];

pub const BINARY_SEARCH_PATHS: &[&str] = &[
    "/usr/local/bin/",
    "/usr/bin/",
    "/bin/",
    "/sbin/",
    "/usr/sbin/",
    "/usr/local/sbin/",
    "./binaries/",
    "./",
    "../",
    "../../",
];

pub const BINARY_PATTERNS: &[&str] = &[
    "curl-impersonate",
    "curl-impersonate.exe",
    "curl_chrome",
    "curl_firefox",
    "curl_edge",
    "curl_safari",
];
