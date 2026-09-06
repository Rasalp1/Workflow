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

// 1. Render onto a 1024x1024 transparent canvas
let canvasSize = CGSize(width: 1024, height: 1024)
let masterImage = NSImage(size: canvasSize)
masterImage.lockFocus()
NSColor.clear.set()
CGRect(origin: .zero, size: canvasSize).fill()

// Draw SVG centered with padding
let drawRect = CGRect(x: 100, y: 100, width: 824, height: 824)
svgImage.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1.0)
masterImage.unlockFocus()

// Save transparent master PNG for public/icon.png
if let tiff = masterImage.tiffRepresentation,
   let rep = NSBitmapImageRep(data: tiff),
   let png = rep.representation(using: .png, properties: [:]) {
    try? png.write(to: URL(fileURLWithPath: "\(currentDir)/public/icon.png"))
}

// 2. Create .iconset directory
let tempIconset = "/tmp/CustomApp.iconset"
try? fileManager.removeItem(atPath: tempIconset)
try? fileManager.createDirectory(atPath: tempIconset, withIntermediateDirectories: true)

let sizes: [(String, Int)] = [
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

for (name, size) in sizes {
    let resized = NSImage(size: CGSize(width: size, height: size))
    resized.lockFocus()
    NSColor.clear.set()
    CGRect(x: 0, y: 0, width: size, height: size).fill()
    masterImage.draw(in: CGRect(x: 0, y: 0, width: size, height: size),
                     from: .zero, operation: .sourceOver, fraction: 1.0)
    resized.unlockFocus()
    
    if let tiff = resized.tiffRepresentation,
       let rep = NSBitmapImageRep(data: tiff),
       let png = rep.representation(using: .png, properties: [:]) {
        try? png.write(to: URL(fileURLWithPath: "\(tempIconset)/\(name)"))
    }
}

// 3. Compile with Apple's iconutil into applet.icns
let icnsPath = "/tmp/applet.icns"
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", tempIconset, "-o", icnsPath]
try? process.run()
process.waitUntilExit()

print("Generated transparent icns at: \(icnsPath)")

// 4. Apply to Desktop applets
let desktopApps = [
    "\(homeDir)/Desktop/Workflow Server.app",
    "\(homeDir)/Desktop/Stop Workflow Server.app"
]

for appPath in desktopApps {
    if fileManager.fileExists(atPath: appPath) {
        let destIcns = "\(appPath)/Contents/Resources/applet.icns"
        try? fileManager.removeItem(atPath: destIcns)
        try? fileManager.copyItem(atPath: icnsPath, toPath: destIcns)
        
        let success = NSWorkspace.shared.setIcon(masterImage, forFile: appPath, options: [])
        print("Applied transparent icon to \(appPath): \(success)")
    } else {
        print("Applet not found at: \(appPath)")
    }
}

// Clean up iconset
try? fileManager.removeItem(atPath: tempIconset)
