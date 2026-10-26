$ErrorActionPreference = "Stop"

$certDir = Join-Path $PSScriptRoot "..\agent\certs"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

$certPath = Join-Path $certDir "cert.pem"
$pfxPath = Join-Path $certDir "cert.pfx"
$password = "nfcv_localhost"

Write-Host "Generating local certificate with SAN (localhost + 127.0.0.1 IP)..."

$cert = New-SelfSignedCertificate `
    -Subject "CN=localhost" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(5) `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -FriendlyName "Network Flow Control Visualizer Local Agent" `
    -TextExtension @( `
        "2.5.29.17={text}dns=localhost&ipaddress=127.0.0.1", `
        "2.5.29.37={text}1.3.6.1.5.5.7.3.1" `
    )

try {
    # Export Certificate PEM (.cer/.pem)
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certBase64 = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
    $certPem = "-----BEGIN CERTIFICATE-----`r`n" + $certBase64 + "`r`n-----END CERTIFICATE-----`r`n"
    [System.IO.File]::WriteAllText($certPath, $certPem, [System.Text.Encoding]::ASCII)

    # Export PFX with password
    $secPass = ConvertTo-SecureString -String $password -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secPass | Out-Null

    Write-Host "Successfully generated certificate files:"
    Write-Host "  PEM Certificate: $certPath"
    Write-Host "  PFX Bundle:      $pfxPath"
    Write-Host "  Thumbprint:      $($cert.Thumbprint)"
}
finally {
    Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue
}

