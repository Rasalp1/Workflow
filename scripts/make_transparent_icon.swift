#!/usr/bin/env swift
import Cocoa

let fileManager = FileManager.default
let homeDir = ProcessInfo.processInfo.environment["HOME"] ?? "/Users/rasmusalpsten"
let currentDir = fileManager.currentDirectoryPath
let svgPath = "\(currentDir)/public/workflow-symbol.svg"

guard let svgData = try? Data(contentsOf: URL(fileURLWithPath: svgPath)),
      let svgImage = NSImage(data: svgData) else {
    fatalError("Failed to parse SVG at \(svgPath)")
}

// 1. Helper to render exact pixel size at 72 DPI using NSBitmapImageRep directly
func renderBitmap(size: Int, from svg: NSImage) -> (NSImage, Data)? {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return nil }
    
    rep.size = NSSize(width: size, height: size) // 72 DPI (exact 1:1 points to pixels)
    
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    
    // Clear to complete transparency
    NSColor.clear.set()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
    
    // Draw SVG centered with padding (100px padding at 1024)
    let pad = CGFloat(size) * (100.0 / 1024.0)
    let drawRect = NSRect(x: pad, y: pad, width: CGFloat(size) - 2 * pad, height: CGFloat(size) - 2 * pad)
    svg.draw(in: drawRect, from: NSRect(origin: .zero, size: svg.size), operation: .sourceOver, fraction: 1.0)
    
    NSGraphicsContext.restoreGraphicsState()
    
    let img = NSImage(size: NSSize(width: size, height: size))
    img.addRepresentation(rep)
    
    guard let pngData = rep.representation(using: .png, properties: [:]) else { return nil }
    return (img, pngData)
}

// 2. Render 1024x1024 master image
guard let (masterImage, masterPng) = renderBitmap(size: 1024, from: svgImage) else {
    fatalError("Failed to render 1024x1024 master image")
}

// Save transparent master PNG to public/icon.png
try? masterPng.write(to: URL(fileURLWithPath: "\(currentDir)/public/icon.png"))

// 3. Create .iconset directory for iconutil
let tempIconset = "/tmp/CustomApp.iconset"
try? fileManager.removeItem(atPath: tempIconset)
try? fileManager.createDirectory(atPath: tempIconset, withIntermediateDirectories: true)

let iconsetSizes: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (name, size) in iconsetSizes {
    if let (_, pngData) = renderBitmap(size: size, from: svgImage) {
        try? pngData.write(to: URL(fileURLWithPath: "\(tempIconset)/\(name)"))
    }
}

// 4. Compile with Apple's iconutil into applet.icns
let icnsPath = "/tmp/applet.icns"
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", tempIconset, "-o", icnsPath]
try? process.run()
process.waitUntilExit()

print("Generated transparent icns at: \(icnsPath)")

// 5. Apply to Desktop applets
let desktopApps = [
    "\(homeDir)/Desktop/Workflow.app",
    "\(homeDir)/Desktop/Workflow Server.app",
    "\(homeDir)/Desktop/Stop Workflow Server.app"
]

for appPath in desktopApps {
    if fileManager.fileExists(atPath: appPath) {
        let contentsDir = "\(appPath)/Contents"
        let resourcesDir = "\(contentsDir)/Resources"
        
        // Remove Assets.car so macOS does not use any compiled squircle asset catalog
        let assetsCar = "\(resourcesDir)/Assets.car"
        if fileManager.fileExists(atPath: assetsCar) {
            try? fileManager.removeItem(atPath: assetsCar)
            print("Removed Assets.car from \(appPath)")
        }
        
        // Remove broken _CodeSignature
        let codeSig = "\(contentsDir)/_CodeSignature"
        if fileManager.fileExists(atPath: codeSig) {
            try? fileManager.removeItem(atPath: codeSig)
            print("Removed invalid _CodeSignature from \(appPath)")
        }
        
        // Copy transparent icns as applet.icns AND AppIcon.icns
        let destIcns = "\(resourcesDir)/applet.icns"
        try? fileManager.removeItem(atPath: destIcns)
        try? fileManager.copyItem(atPath: icnsPath, toPath: destIcns)
        
        let destAppIconIcns = "\(resourcesDir)/AppIcon.icns"
        try? fileManager.removeItem(atPath: destAppIconIcns)
        try? fileManager.copyItem(atPath: icnsPath, toPath: destAppIconIcns)
        
        // Copy transparent PNG as AppIcon.png
        let destAppIconPng = "\(resourcesDir)/AppIcon.png"
        try? fileManager.removeItem(atPath: destAppIconPng)
        try? masterPng.write(to: URL(fileURLWithPath: destAppIconPng))
        
        // Clean Info.plist: remove CFBundleIconName so macOS falls back directly to CFBundleIconFile
        let plistPath = "\(contentsDir)/Info.plist"
        if let plistData = try? Data(contentsOf: URL(fileURLWithPath: plistPath)),
           var plistDict = try? PropertyListSerialization.propertyList(from: plistData, format: nil) as? [String: Any] {
            plistDict.removeValue(forKey: "CFBundleIconName")
            plistDict["CFBundleIconFile"] = "applet"
            if let updatedData = try? PropertyListSerialization.data(fromPropertyList: plistDict, format: .xml, options: 0) {
                try? updatedData.write(to: URL(fileURLWithPath: plistPath))
                print("Cleaned CFBundleIconName from \(plistPath)")
            }
        }
        
        // Call NSWorkspace.shared.setIcon() to set the kHasCustomIcon Finder flag
        let success = NSWorkspace.shared.setIcon(masterImage, forFile: appPath, options: [])
        print("Applied transparent icon to \(appPath): \(success)")
    } else {
        print("Applet not found at: \(appPath)")
    }
}

// Clean up iconset
try? fileManager.removeItem(atPath: tempIconset)
print("Done generating transparent icons!")

