#!/usr/bin/env swift
import Cocoa

let fileManager = FileManager.default
let homeDir = ProcessInfo.processInfo.environment["HOME"] ?? NSHomeDirectory()
let currentDir = fileManager.currentDirectoryPath
let masterIconPath = "\(currentDir)/public/icon.png"

guard let masterIconData = try? Data(contentsOf: URL(fileURLWithPath: masterIconPath)),
      let sourceImage = NSImage(data: masterIconData) else {
    fatalError("Failed to load transparent master icon at \(masterIconPath)")
}

// 1. Helper to render exact pixel size at 72 DPI using NSBitmapImageRep directly
func renderBitmap(size: Int, from source: NSImage) -> (NSImage, Data)? {
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
    
    source.draw(
        in: NSRect(x: 0, y: 0, width: size, height: size),
        from: NSRect(origin: .zero, size: source.size),
        operation: .copy,
        fraction: 1.0
    )
    
    NSGraphicsContext.restoreGraphicsState()
    
    let img = NSImage(size: NSSize(width: size, height: size))
    img.addRepresentation(rep)
    
    guard let pngData = rep.representation(using: .png, properties: [:]) else { return nil }
    return (img, pngData)
}

// 2. Validate that the transparent source can be rendered at the master size.
guard renderBitmap(size: 1024, from: sourceImage) != nil else {
    fatalError("Failed to render 1024x1024 master image")
}

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
    if let (_, pngData) = renderBitmap(size: size, from: sourceImage) {
        try? pngData.write(to: URL(fileURLWithPath: "\(tempIconset)/\(name)"))
    }
}

// 4. Compile with Apple's iconutil into the same AppIcon.icns format used by
// Manageur and Skiller. Keeping applet.icns as a compatibility copy is useful
// for AppleScript applets, but AppIcon is the canonical bundle icon.
let icnsPath = "/tmp/WorkflowAppIcon.icns"
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

func adHocSign(_ appPath: String) {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
    process.arguments = ["--force", "--deep", "--sign", "-", appPath]
    try? process.run()
    process.waitUntilExit()
    print("Ad-hoc signed \(appPath): \(process.terminationStatus == 0)")
}

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
        
        // Copy the exact transparent source PNG as AppIcon.png
        let destAppIconPng = "\(resourcesDir)/AppIcon.png"
        try? fileManager.removeItem(atPath: destAppIconPng)
        try? masterIconData.write(to: URL(fileURLWithPath: destAppIconPng))
        
        // Match the proven Manageur/Skiller setup: use the compiled AppIcon.icns
        // directly and do not let an asset catalog or CFBundleIconName override it.
        let plistPath = "\(contentsDir)/Info.plist"
        if let plistData = try? Data(contentsOf: URL(fileURLWithPath: plistPath)),
           var plistDict = try? PropertyListSerialization.propertyList(from: plistData, format: nil) as? [String: Any] {
            plistDict.removeValue(forKey: "CFBundleIconName")
            plistDict["CFBundleIconFile"] = "AppIcon"
            if let updatedData = try? PropertyListSerialization.data(fromPropertyList: plistDict, format: .xml, options: 0) {
                try? updatedData.write(to: URL(fileURLWithPath: plistPath))
                print("Cleaned CFBundleIconName from \(plistPath)")
            }
        }

        adHocSign(appPath)
        
        // Set Finder's kHasCustomIcon flag from the compiled ICNS, exactly as
        // Manageur and Skiller do. This is what keeps the transparent silhouette
        // on both the Desktop and in the Dock.
        let customIcon = NSImage(contentsOfFile: destAppIconIcns)
        let success = customIcon.map {
            NSWorkspace.shared.setIcon($0, forFile: appPath, options: [])
        } ?? false
        print("Applied transparent AppIcon.icns to \(appPath): \(success)")

        // Refresh the bundle timestamp and LaunchServices registration so the
        // Dock does not keep using a stale applet icon.
        try? fileManager.setAttributes([.modificationDate: Date()], ofItemAtPath: appPath)
        let register = Process()
        register.executableURL = URL(fileURLWithPath: "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister")
        register.arguments = ["-f", appPath]
        try? register.run()
        register.waitUntilExit()
    } else {
        print("Applet not found at: \(appPath)")
    }
}

// Clean up iconset
try? fileManager.removeItem(atPath: tempIconset)
print("Done generating transparent icons!")
