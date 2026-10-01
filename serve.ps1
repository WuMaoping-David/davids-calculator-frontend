param([int]$Port = 5173)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path "$PSScriptRoot/target/preview" | Out-Null
& javac -encoding UTF-8 -source 8 -target 8 -d "$PSScriptRoot/target/preview" "$PSScriptRoot/tools/PreviewServer.java"
if ($LASTEXITCODE -ne 0) { throw 'Preview server compilation failed.' }
& java '-Dfile.encoding=UTF-8' -cp "$PSScriptRoot/target/preview" PreviewServer $PSScriptRoot $Port
if ($LASTEXITCODE -ne 0) { throw 'Preview server stopped with an error.' }
