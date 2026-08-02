$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'public\icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null

function New-RoundedRectanglePath {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Write-MathPlusIcon {
  param([int]$Size, [string]$FileName, [bool]$Maskable)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scale = $Size / 512.0

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $blue = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0284c7'))
    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $yellow = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#facc15'))
    $bluePen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#0284c7'), [Math]::Max(2, 8 * $scale))
    $bluePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    try {
      if ($Maskable) {
        $graphics.FillRectangle($blue, 0, 0, $Size, $Size)
      } else {
        $background = New-RoundedRectanglePath 0 0 $Size $Size (96 * $scale)
        try { $graphics.FillPath($blue, $background) } finally { $background.Dispose() }
      }

      $paper = New-RoundedRectanglePath (136 * $scale) (96 * $scale) (200 * $scale) (260 * $scale) (16 * $scale)
      try { $graphics.FillPath($white, $paper) } finally { $paper.Dispose() }

      foreach ($line in @(
        @(168, 150, 136),
        @(168, 190, 136),
        @(168, 230, 90)
      )) {
        $linePath = New-RoundedRectanglePath ($line[0] * $scale) ($line[1] * $scale) ($line[2] * $scale) (14 * $scale) (7 * $scale)
        try { $graphics.FillPath($blue, $linePath) } finally { $linePath.Dispose() }
      }

      $pencilPoints = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(300 * $scale, 300 * $scale),
        [System.Drawing.PointF]::new(392 * $scale, 208 * $scale),
        [System.Drawing.PointF]::new(424 * $scale, 240 * $scale),
        [System.Drawing.PointF]::new(332 * $scale, 332 * $scale),
        [System.Drawing.PointF]::new(296 * $scale, 340 * $scale)
      )
      $graphics.FillPolygon($yellow, $pencilPoints)
      $graphics.DrawPolygon($bluePen, $pencilPoints)
    } finally {
      $blue.Dispose()
      $white.Dispose()
      $yellow.Dispose()
      $bluePen.Dispose()
    }

    $outputPath = Join-Path $iconDirectory $FileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated $outputPath"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

Write-MathPlusIcon -Size 192 -FileName 'icon-192.png' -Maskable $false
Write-MathPlusIcon -Size 512 -FileName 'icon-512.png' -Maskable $false
Write-MathPlusIcon -Size 512 -FileName 'icon-maskable-512.png' -Maskable $true
Write-MathPlusIcon -Size 180 -FileName 'apple-touch-icon.png' -Maskable $false

