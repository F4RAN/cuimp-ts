@echo off
"%~dp0curl.exe" ^
    --ciphers "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384" ^
    --curves X25519:P-256 ^
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" ^
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8" ^
    -H "Accept-Language: en-US,en;q=0.9" ^
    --http2 ^
    --tls-grease ^
    %*