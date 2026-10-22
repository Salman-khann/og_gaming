param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$packageSource = (Resolve-Path -LiteralPath $Source).Path
$packageDestination = [System.IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $packageDestination) { throw 'Archive already exists.' }
$packageWriter = [System.IO.Compression.ZipFile]::Open($packageDestination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($packageFile in [System.IO.Directory]::EnumerateFiles($packageSource, '*', [System.IO.SearchOption]::AllDirectories)) {
    $packageEntryName = $packageFile.Substring($packageSource.TrimEnd('\').Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageWriter, $packageFile, $packageEntryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $packageWriter.Dispose() }
$packageArchive = [System.IO.Compression.ZipFile]::OpenRead($packageDestination)
try {
  if (-not ($packageArchive.Entries.FullName -contains 'server.js')) { throw 'Missing startup file.' }
  if (-not ($packageArchive.Entries.FullName -contains '.next/BUILD_ID')) { throw 'Missing production build.' }
  if ($packageArchive.Entries.FullName -match '(^|/)(\.env[^/]*|node_modules|\.git|cache|backups)(/|$)') { throw 'Private or unnecessary files found.' }
} finally { $packageArchive.Dispose() }
