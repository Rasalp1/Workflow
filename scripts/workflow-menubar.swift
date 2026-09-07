import Cocoa
import Foundation

// MARK: - Decodable Models

struct PRUser: Decodable {
    let login: String?
}

struct PRBranch: Decodable {
    let ref: String?
}

struct PullRequestItem: Decodable {
    let id: Int?
    let number: Int
    let title: String
    let html_url: String?
    let state: String?
    let is_draft: Bool?
    let head: PRBranch?
    let base: PRBranch?
    let user: PRUser?
    let repo_name: String?
    let repo_full_name: String?
    let comments_count: Int?
    let has_merge_conflicts: Bool?
    let needs_attention: Bool?
}

struct GateRule: Decodable {
    let id: String?
    let name: String?
    let buttonLabel: String?
    let actionType: String?
}

struct EvaluatedGate: Decodable {
    let rule: GateRule?
    let passed: Bool?
}

struct PRWithGatesItem: Decodable {
    let pr: PullRequestItem
    let evaluatedGates: [EvaluatedGate]?
    let needsAttention: Bool?
}

struct ApiResponse: Decodable {
    let success: Bool?
    let currentUser: String?
    let prsWithGates: [PRWithGatesItem]?
    let monitoredRepos: [String]?
    let awaitingCommentCount: Int?
    let theirsToHandleCount: Int?
    let error: String?
}

// MARK: - Filter Mode

enum PRFilterMode {
    case all
    case needsAttention
    case waitingOnOthers
}

// MARK: - Menu Action Helper

class MenuItemTarget: NSObject {
    let handler: () -> Void
    init(_ handler: @escaping () -> Void) {
        self.handler = handler
        super.init()
    }
    @objc func invoke() {
        handler()
    }
}

// MARK: - Custom Summary Bar Header View (Mirrors App Header Bar)

class SummaryBarHeaderView: NSView {
    var user: String = "User"
    var isOffline: Bool = false
    var port: Int = 3000
    var waitingCount: Int = 0
    var attentionCount: Int = 0
    var currentFilter: PRFilterMode = .all
    var errorMessage: String?
    
    var onFilterSelect: ((PRFilterMode) -> Void)?
    var onOpenDashboard: (() -> Void)?
    
    // Geometry cache for hit-testing
    private var waitingCardRect = NSRect.zero
    private var attentionCardRect = NSRect.zero
    private var topBarRect = NSRect.zero
    
    override var isFlipped: Bool { return true }
    
    init(frame: NSRect,
         user: String,
         isOffline: Bool,
         port: Int,
         waitingCount: Int,
         attentionCount: Int,
         currentFilter: PRFilterMode,
         errorMessage: String?,
         onFilterSelect: ((PRFilterMode) -> Void)?,
         onOpenDashboard: (() -> Void)?) {
        self.user = user
        self.isOffline = isOffline
        self.port = port
        self.waitingCount = waitingCount
        self.attentionCount = attentionCount
        self.currentFilter = currentFilter
        self.errorMessage = errorMessage
        self.onFilterSelect = onFilterSelect
        self.onOpenDashboard = onOpenDashboard
        super.init(frame: frame)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        
        let isDark: Bool
        if #available(macOS 10.14, *) {
            isDark = effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        } else {
            isDark = false
        }
        
        let bounds = self.bounds
        let sideMargin: CGFloat = 12
        let topMargin: CGFloat = 10
        let cardHeight: CGFloat = 48
        let cardGap: CGFloat = 10
        let cardWidth = (bounds.width - (sideMargin * 2) - cardGap) / 2
        
        topBarRect = NSRect(x: sideMargin, y: topMargin, width: bounds.width - (sideMargin * 2), height: 18)
        waitingCardRect = NSRect(x: sideMargin, y: 34, width: cardWidth, height: cardHeight)
        attentionCardRect = NSRect(x: sideMargin + cardWidth + cardGap, y: 34, width: cardWidth, height: cardHeight)
        
        // -------------------------------------------------------------
        // 1. Top Bar: App Branding & User Status
        // -------------------------------------------------------------
        
        // Brand Title
        let brandFont = NSFont.systemFont(ofSize: 11, weight: .bold)
        let brandColor = isDark
            ? NSColor(srgbRed: 0.55, green: 0.68, blue: 0.95, alpha: 1.0)
            : NSColor(srgbRed: 0.22, green: 0.38, blue: 0.78, alpha: 1.0)
        let brandAttrs: [NSAttributedString.Key: Any] = [
            .font: brandFont,
            .foregroundColor: brandColor
        ]
        NSString(string: "WORKFLOW").draw(at: NSPoint(x: sideMargin + 2, y: topMargin + 1), withAttributes: brandAttrs)
        
        // Status Right
        let statusFont = NSFont.systemFont(ofSize: 10.5, weight: .regular)
        let statusTextColor = isDark ? NSColor(white: 0.70, alpha: 1.0) : NSColor(white: 0.45, alpha: 1.0)
        let statusText = isOffline ? "Offline" : (errorMessage != nil ? "Issue" : "@\(user)")
        let statusDotColor = isOffline
            ? NSColor.systemRed
            : (errorMessage != nil
                ? NSColor.systemOrange
                : (isDark ? NSColor(srgbRed: 0.35, green: 0.85, blue: 0.45, alpha: 1.0) : NSColor(srgbRed: 0.15, green: 0.65, blue: 0.25, alpha: 1.0)))
        
        let statusAttrs: [NSAttributedString.Key: Any] = [
            .font: statusFont,
            .foregroundColor: statusTextColor
        ]
        let statusSize = NSString(string: statusText).size(withAttributes: statusAttrs)
        let statusX = bounds.width - sideMargin - statusSize.width
        let dotX = statusX - 11
        let dotY = topMargin + 6.5
        
        let statusDot = NSBezierPath(ovalIn: NSRect(x: dotX, y: dotY, width: 6, height: 6))
        statusDotColor.setFill()
        statusDot.fill()
        
        NSString(string: statusText).draw(at: NSPoint(x: statusX, y: topMargin + 1.5), withAttributes: statusAttrs)
        
        // -------------------------------------------------------------
        // 2. Card 1: Waiting on others (Mirrors .summary-item)
        // -------------------------------------------------------------
        drawWaitingCard(rect: waitingCardRect, isDark: isDark)
        
        // -------------------------------------------------------------
        // 3. Card 2: Needs your attention (Mirrors .summary-item--attention)
        // -------------------------------------------------------------
        drawAttentionCard(rect: attentionCardRect, isDark: isDark)
    }
    
    private func drawWaitingCard(rect: NSRect, isDark: Bool) {
        let isSelected = (currentFilter == .waitingOnOthers)
        
        // Background & Border colors
        let bgFill: NSColor
        let borderCol: NSColor
        let borderWidth: CGFloat = isSelected ? 2.0 : 1.0
        
        if isSelected {
            bgFill = isDark ? NSColor(srgbRed: 0.14, green: 0.22, blue: 0.35, alpha: 0.95)
                            : NSColor(srgbRed: 0.92, green: 0.95, blue: 1.0, alpha: 1.0)
            borderCol = isDark ? NSColor(srgbRed: 0.38, green: 0.62, blue: 0.95, alpha: 1.0)
                               : NSColor(srgbRed: 0.22, green: 0.43, blue: 0.86, alpha: 1.0)
        } else if isDark {
            bgFill = NSColor(white: 0.16, alpha: 0.85)
            borderCol = NSColor(white: 0.28, alpha: 0.85)
        } else {
            bgFill = NSColor(srgbRed: 0.969, green: 0.976, blue: 0.988, alpha: 1.0) // #F7F9FC
            borderCol = NSColor(srgbRed: 0.847, green: 0.875, blue: 0.918, alpha: 1.0) // #D8DFEA
        }
        
        let path = NSBezierPath(roundedRect: rect, xRadius: 8, yRadius: 8)
        bgFill.setFill()
        path.fill()
        
        borderCol.setStroke()
        path.lineWidth = borderWidth
        path.stroke()
        
        // Status Dot
        let dotColor = isDark
            ? NSColor(srgbRed: 0.580, green: 0.639, blue: 0.722, alpha: 1.0) // #94A3B8
            : NSColor(srgbRed: 0.392, green: 0.455, blue: 0.545, alpha: 1.0) // #64748B
        let dotCenterY = rect.midY
        let dotPath = NSBezierPath(ovalIn: NSRect(x: rect.minX + 9, y: dotCenterY - 3, width: 6, height: 6))
        dotColor.setFill()
        dotPath.fill()
        
        // Badge (Pill with count) on the right
        let badgeStr = "\(waitingCount)"
        let badgeFont = NSFont.systemFont(ofSize: 13, weight: .bold)
        let badgeTextAttrs: [NSAttributedString.Key: Any] = [
            .font: badgeFont,
            .foregroundColor: isDark ? NSColor(white: 0.92, alpha: 1.0) : NSColor(srgbRed: 0.278, green: 0.337, blue: 0.427, alpha: 1.0) // #47566D
        ]
        let badgeSize = NSString(string: badgeStr).size(withAttributes: badgeTextAttrs)
        let badgeW = max(24, badgeSize.width + 12)
        let badgeH: CGFloat = 22
        let badgeX = rect.maxX - 8 - badgeW
        let badgeY = rect.midY - (badgeH / 2)
        let badgeRect = NSRect(x: badgeX, y: badgeY, width: badgeW, height: badgeH)
        
        let badgeBg = isDark
            ? NSColor(white: 0.27, alpha: 1.0)
            : NSColor(srgbRed: 0.914, green: 0.929, blue: 0.957, alpha: 1.0) // #E9EDF4
        let badgePath = NSBezierPath(roundedRect: badgeRect, xRadius: 5, yRadius: 5)
        badgeBg.setFill()
        badgePath.fill()
        
        let badgeTextX = badgeRect.midX - (badgeSize.width / 2)
        let badgeTextY = badgeRect.midY - (badgeSize.height / 2)
        NSString(string: badgeStr).draw(at: NSPoint(x: badgeTextX, y: badgeTextY), withAttributes: badgeTextAttrs)
        
        // Label: "Waiting on others"
        let labelFont = NSFont.systemFont(ofSize: 11, weight: .medium)
        let labelColor = isDark
            ? NSColor(white: 0.92, alpha: 1.0)
            : NSColor(srgbRed: 0.200, green: 0.255, blue: 0.333, alpha: 1.0) // #334155
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: labelFont,
            .foregroundColor: labelColor
        ]
        let labelX = rect.minX + 19
        let labelY = rect.midY - 7
        NSString(string: "Waiting on others").draw(at: NSPoint(x: labelX, y: labelY), withAttributes: labelAttrs)
    }
    
    private func drawAttentionCard(rect: NSRect, isDark: Bool) {
        let isSelected = (currentFilter == .needsAttention)
        
        // Background & Border colors (Warm amber / cream styling)
        let bgFill: NSColor
        let borderCol: NSColor
        let borderWidth: CGFloat = isSelected ? 2.0 : 1.0
        
        if isSelected {
            bgFill = isDark ? NSColor(srgbRed: 0.32, green: 0.20, blue: 0.05, alpha: 0.95)
                            : NSColor(srgbRed: 1.0, green: 0.94, blue: 0.82, alpha: 1.0)
            borderCol = isDark ? NSColor(srgbRed: 0.98, green: 0.70, blue: 0.20, alpha: 1.0)
                               : NSColor(srgbRed: 0.85, green: 0.47, blue: 0.02, alpha: 1.0)
        } else if isDark {
            bgFill = NSColor(srgbRed: 0.24, green: 0.16, blue: 0.04, alpha: 0.85)
            borderCol = NSColor(srgbRed: 0.65, green: 0.42, blue: 0.08, alpha: 0.85)
        } else {
            bgFill = NSColor(srgbRed: 1.0, green: 0.965, blue: 0.894, alpha: 1.0) // #FFF6E4
            borderCol = NSColor(srgbRed: 0.906, green: 0.780, blue: 0.518, alpha: 1.0) // #E7C784
        }
        
        let path = NSBezierPath(roundedRect: rect, xRadius: 8, yRadius: 8)
        bgFill.setFill()
        path.fill()
        
        borderCol.setStroke()
        path.lineWidth = borderWidth
        path.stroke()
        
        // Amber Status Dot
        let dotColor = isDark
            ? NSColor(srgbRed: 0.980, green: 0.749, blue: 0.141, alpha: 1.0) // #FBBF24
            : NSColor(srgbRed: 0.851, green: 0.467, blue: 0.024, alpha: 1.0) // #D97706
        let dotCenterY = rect.midY
        let dotPath = NSBezierPath(ovalIn: NSRect(x: rect.minX + 9, y: dotCenterY - 3.5, width: 7, height: 7))
        dotColor.setFill()
        dotPath.fill()
        
        // Badge (Pill with count) on the right
        let badgeStr = "\(attentionCount)"
        let badgeFont = NSFont.systemFont(ofSize: 13, weight: .bold)
        let badgeTextAttrs: [NSAttributedString.Key: Any] = [
            .font: badgeFont,
            .foregroundColor: isDark ? NSColor(srgbRed: 1.0, green: 0.95, blue: 0.80, alpha: 1.0)
                                     : NSColor(srgbRed: 0.522, green: 0.298, blue: 0.012, alpha: 1.0) // #854C03
        ]
        let badgeSize = NSString(string: badgeStr).size(withAttributes: badgeTextAttrs)
        let badgeW = max(24, badgeSize.width + 12)
        let badgeH: CGFloat = 22
        let badgeX = rect.maxX - 8 - badgeW
        let badgeY = rect.midY - (badgeH / 2)
        let badgeRect = NSRect(x: badgeX, y: badgeY, width: badgeW, height: badgeH)
        
        let badgeBg = isDark
            ? NSColor(srgbRed: 0.48, green: 0.28, blue: 0.05, alpha: 1.0)
            : NSColor(srgbRed: 1.0, green: 0.906, blue: 0.718, alpha: 1.0) // #FFE7B7
        let badgePath = NSBezierPath(roundedRect: badgeRect, xRadius: 5, yRadius: 5)
        badgeBg.setFill()
        badgePath.fill()
        
        let badgeTextX = badgeRect.midX - (badgeSize.width / 2)
        let badgeTextY = badgeRect.midY - (badgeSize.height / 2)
        NSString(string: badgeStr).draw(at: NSPoint(x: badgeTextX, y: badgeTextY), withAttributes: badgeTextAttrs)
        
        // Label: "Needs attention"
        let labelFont = NSFont.systemFont(ofSize: 11, weight: .semibold)
        let labelColor = isDark
            ? NSColor(srgbRed: 0.988, green: 0.847, blue: 0.490, alpha: 1.0) // #FDE68A
            : NSColor(srgbRed: 0.545, green: 0.329, blue: 0.043, alpha: 1.0) // #8B540B
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: labelFont,
            .foregroundColor: labelColor
        ]
        let labelX = rect.minX + 20
        let labelY = rect.midY - 7
        NSString(string: "Needs attention").draw(at: NSPoint(x: labelX, y: labelY), withAttributes: labelAttrs)
    }
    
    // MARK: - Mouse Event Handling
    
    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        
        if attentionCardRect.contains(point) {
            let nextFilter: PRFilterMode = (currentFilter == .needsAttention) ? .all : .needsAttention
            onFilterSelect?(nextFilter)
        } else if waitingCardRect.contains(point) {
            let nextFilter: PRFilterMode = (currentFilter == .waitingOnOthers) ? .all : .waitingOnOthers
            onFilterSelect?(nextFilter)
        } else if topBarRect.contains(point) {
            onOpenDashboard?()
        }
    }
}

// MARK: - Custom Refresh Menu Item View (Does not collapse menu on click)

class RefreshMenuItemView: NSView {
    var onRefresh: (() -> Void)?
    var isRefreshing: Bool = false {
        didSet {
            needsDisplay = true
        }
    }
    
    private var isHighlighted: Bool = false
    private var trackingArea: NSTrackingArea?
    
    override var isFlipped: Bool { return true }
    
    init(frame: NSRect, isRefreshing: Bool, onRefresh: (() -> Void)?) {
        self.isRefreshing = isRefreshing
        self.onRefresh = onRefresh
        super.init(frame: frame)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area = trackingArea {
            removeTrackingArea(area)
        }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeInActiveApp, .activeAlways],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(area)
        trackingArea = area
    }
    
    override func mouseEntered(with event: NSEvent) {
        isHighlighted = true
        needsDisplay = true
    }
    
    override func mouseExited(with event: NSEvent) {
        isHighlighted = false
        needsDisplay = true
    }
    
    override func mouseDown(with event: NSEvent) {
        isHighlighted = true
        needsDisplay = true
    }
    
    override func mouseUp(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        if bounds.contains(point) {
            isRefreshing = true
            needsDisplay = true
            onRefresh?()
        }
    }
    
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        
        let bounds = self.bounds
        
        if isHighlighted {
            let selRect = NSRect(x: 5, y: 1, width: bounds.width - 10, height: bounds.height - 2)
            let selPath = NSBezierPath(roundedRect: selRect, xRadius: 4, yRadius: 4)
            NSColor.selectedContentBackgroundColor.setFill()
            selPath.fill()
        }
        
        let labelColor = isHighlighted ? NSColor.white : NSColor.labelColor
        let shortcutColor = isHighlighted ? NSColor(white: 1.0, alpha: 0.85) : NSColor.secondaryLabelColor
        
        // Icon
        let iconRect = NSRect(x: 18, y: 6, width: 14, height: 14)
        if #available(macOS 11.0, *) {
            let symbolName = isRefreshing ? "arrow.triangle.2.circlepath" : "arrow.clockwise"
            let symbolConfig = NSImage.SymbolConfiguration(pointSize: 12, weight: .regular)
            if let img = NSImage(systemSymbolName: symbolName, accessibilityDescription: "Refresh")?.withSymbolConfiguration(symbolConfig) {
                img.isTemplate = true
                if isHighlighted {
                    let maskImg = img.copy() as! NSImage
                    maskImg.lockFocus()
                    NSColor.white.set()
                    NSRect(origin: .zero, size: maskImg.size).fill(using: .sourceIn)
                    maskImg.unlockFocus()
                    maskImg.draw(in: iconRect)
                } else {
                    img.draw(in: iconRect)
                }
            }
        }
        
        // Text
        let labelText = isRefreshing ? "Refreshing PRs..." : "Refresh PRs Now"
        let font = NSFont.systemFont(ofSize: 13, weight: .regular)
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: labelColor
        ]
        NSString(string: labelText).draw(at: NSPoint(x: 38, y: 4.5), withAttributes: attrs)
        
        // Shortcut
        let shortcutFont = NSFont.systemFont(ofSize: 13, weight: .regular)
        let shortcutAttrs: [NSAttributedString.Key: Any] = [
            .font: shortcutFont,
            .foregroundColor: shortcutColor
        ]
        NSString(string: "⌘R").draw(at: NSPoint(x: bounds.width - 34, y: 4.5), withAttributes: shortcutAttrs)
    }
}

// MARK: - Application Delegate

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem!
    private var menu: NSMenu!
    private var activeTargets: [MenuItemTarget] = []
    
    private var port: Int = 3000
    private var parentPid: Int32 = 0
    private var pollTimer: Timer?
    private var parentCheckTimer: Timer?
    
    private var latestData: ApiResponse?
    private var isOffline: Bool = true
    private var isFetching: Bool = false
    private var lastFetchTime: Date?
    
    private var currentFilter: PRFilterMode = .needsAttention
    private var isMenuCurrentlyOpen: Bool = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        parseArguments()
        setupStatusItem()
        setupTimers()
        fetchPRs()
    }
    
    private func parseArguments() {
        let args = ProcessInfo.processInfo.arguments
        for i in 0..<args.count {
            if args[i] == "--port", i + 1 < args.count, let p = Int(args[i + 1]) {
                port = p
            } else if args[i] == "--parent-pid", i + 1 < args.count, let pid = Int32(args[i + 1]) {
                parentPid = pid
            }
        }
    }
    
    private func createWorkflowMenubarIcon() -> NSImage {
        let svgString = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
          <path d="M0 0h24v24H0z" fill="none" />
          <g fill="none" stroke="#000000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2Zm10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2Zm-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2Z" />
            <path d="M17 11c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1" />
          </g>
        </svg>
        """
        if let data = svgString.data(using: .utf8),
           let svgImg = NSImage(data: data) {
            let img = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { rect in
                svgImg.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1.0)
                return true
            }
            img.isTemplate = true
            return img
        }
        
        // Fallback
        if #available(macOS 11.0, *) {
            let symbolConfig = NSImage.SymbolConfiguration(pointSize: 13, weight: .medium)
            if let image = NSImage(systemSymbolName: "arrow.triangle.pull", accessibilityDescription: "Workflow")?.withSymbolConfiguration(symbolConfig) {
                image.isTemplate = true
                return image
            }
        }
        let fallback = NSImage(size: NSSize(width: 18, height: 18))
        fallback.isTemplate = true
        return fallback
    }
    
    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = createWorkflowMenubarIcon()
            button.imagePosition = .imageLeft
            button.title = " …"
            button.toolTip = "Workflow: Connecting to server..."
        }
        
        menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
        
        renderMenu()
    }
    
    private func setupTimers() {
        // Poll every 30 seconds for PR updates
        pollTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.fetchPRs()
        }
        
        // Check parent PID every 3 seconds to exit when dev server exits
        if parentPid > 0 {
            parentCheckTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
                guard let self = self else { return }
                if kill(self.parentPid, 0) != 0 {
                    // Parent process is no longer running
                    NSApplication.shared.terminate(nil)
                }
            }
        }
    }
    
    func menuWillOpen(_ menu: NSMenu) {
        isMenuCurrentlyOpen = true
        currentFilter = .needsAttention
        renderMenu()
        // If it's been more than 10 seconds since last fetch, refresh when opening menu
        if let last = lastFetchTime, Date().timeIntervalSince(last) > 10 {
            fetchPRs()
        } else if lastFetchTime == nil {
            fetchPRs()
        }
    }
    
    func menuDidClose(_ menu: NSMenu) {
        isMenuCurrentlyOpen = false
    }
    
    // MARK: - Data Fetching
    
    private func fetchPRs() {
        guard !isFetching else { return }
        isFetching = true
        
        guard let url = URL(string: "http://localhost:\(port)/api/prs") else {
            isFetching = false
            return
        }
        
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 10.0
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isFetching = false
                
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200, let data = data {
                    do {
                        let parsed = try JSONDecoder().decode(ApiResponse.self, from: data)
                        self.latestData = parsed
                        self.isOffline = false
                        self.lastFetchTime = Date()
                        self.updateStatusBarBadge()
                        self.renderMenu()
                    } catch {
                        self.isOffline = false
                        self.updateStatusBarBadge(error: true)
                        self.renderMenu()
                    }
                } else {
                    self.isOffline = true
                    self.updateStatusBarBadge(offline: true)
                    self.renderMenu()
                }
            }
        }.resume()
    }
    
    private func isAttentionPR(_ item: PRWithGatesItem) -> Bool {
        if let explicit = item.needsAttention {
            return explicit
        }
        if let prExplicit = item.pr.needs_attention {
            return prExplicit
        }
        if item.pr.has_merge_conflicts == true {
            return true
        }
        return false
    }
    
    private func updateStatusBarBadge(offline: Bool = false, error: Bool = false) {
        guard let button = statusItem.button else { return }
        
        if offline {
            button.title = " ⚠️"
            button.toolTip = "Workflow: Server offline (localhost:\(port))"
            return
        }
        
        if error || (latestData?.error != nil && (latestData?.prsWithGates?.isEmpty ?? true)) {
            button.title = " ⚠️"
            button.toolTip = "Workflow: \(latestData?.error ?? "Error reading PR data")"
            return
        }
        
        let prs = latestData?.prsWithGates ?? []
        let attentionCount = prs.filter { isAttentionPR($0) }.count
        let totalCount = prs.count
        
        if attentionCount > 0 {
            button.title = " \(attentionCount)"
            button.toolTip = "Workflow: \(attentionCount) PR\(attentionCount == 1 ? "" : "s") need attention (\(totalCount) total)"
        } else if totalCount > 0 {
            button.title = " \(totalCount)"
            button.toolTip = "Workflow: All caught up! (\(totalCount) waiting on others)"
        } else {
            button.title = ""
            button.toolTip = "Workflow: No open pull requests 🎉"
        }
    }
    
    // MARK: - Menu Rendering
    
    private func renderMenu() {
        let oldItems = menu.items
        activeTargets.removeAll()
        
        let prs = latestData?.prsWithGates ?? []
        let user = latestData?.currentUser ?? "User"
        
        let attentionPRs = prs.filter { isAttentionPR($0) }
        let waitingPRs = prs.filter { !isAttentionPR($0) }
        
        let attentionCount = latestData?.awaitingCommentCount ?? attentionPRs.count
        let waitingCount = latestData?.theirsToHandleCount ?? waitingPRs.count
        
        var newItems: [NSMenuItem] = []
        
        // -------------------------------------------------------------
        // 1. Custom Header: "Waiting on others / Needs your attention" Bar
        // -------------------------------------------------------------
        let headerWidth: CGFloat = 360
        let headerHeight: CGFloat = 90
        let headerView = SummaryBarHeaderView(
            frame: NSRect(x: 0, y: 0, width: headerWidth, height: headerHeight),
            user: user,
            isOffline: isOffline,
            port: port,
            waitingCount: waitingCount,
            attentionCount: attentionCount,
            currentFilter: currentFilter,
            errorMessage: latestData?.error,
            onFilterSelect: { [weak self] newFilter in
                guard let self = self else { return }
                self.currentFilter = newFilter
                self.renderMenu()
            },
            onOpenDashboard: { [weak self] in
                guard let self = self else { return }
                if let url = URL(string: "http://localhost:\(self.port)") {
                    NSWorkspace.shared.open(url)
                }
            }
        )
        
        let headerItem = NSMenuItem()
        headerItem.view = headerView
        newItems.append(headerItem)
        newItems.append(NSMenuItem.separator())
        
        // -------------------------------------------------------------
        // Error banner if connection issue
        // -------------------------------------------------------------
        if let err = latestData?.error {
            let errItem = NSMenuItem(title: "  ⚠️ \(err)", action: nil, keyEquivalent: "")
            errItem.isEnabled = false
            newItems.append(errItem)
            newItems.append(NSMenuItem.separator())
        }
        
        // -------------------------------------------------------------
        // 2. Section: 🟡 Needs Your Attention
        // -------------------------------------------------------------
        if currentFilter == .all || currentFilter == .needsAttention {
            let attentionHeader = createSectionHeader(
                title: "Needs your attention",
                dotColor: NSColor(srgbRed: 0.85, green: 0.47, blue: 0.02, alpha: 1.0),
                count: attentionCount
            )
            newItems.append(attentionHeader)
            
            if attentionPRs.isEmpty {
                let emptyAttention = NSMenuItem(
                    title: "    ✓ All caught up! No PRs require your attention 🎉",
                    action: nil,
                    keyEquivalent: ""
                )
                emptyAttention.isEnabled = false
                if let font = NSFont.systemFont(ofSize: 11, weight: .regular) as NSFont? {
                    emptyAttention.attributedTitle = NSAttributedString(
                        string: "    ✓ All caught up! No PRs require your attention 🎉",
                        attributes: [.font: font, .foregroundColor: NSColor.secondaryLabelColor]
                    )
                }
                newItems.append(emptyAttention)
            } else {
                for item in attentionPRs {
                    let prItem = createPRMenuItem(item: item, isAttention: true)
                    newItems.append(prItem)
                }
            }
        }
        
        // -------------------------------------------------------------
        // 3. Section: ⚪ Waiting On Others
        // -------------------------------------------------------------
        if currentFilter == .all || currentFilter == .waitingOnOthers {
            if currentFilter == .all {
                newItems.append(NSMenuItem.separator())
            }
            
            let waitingHeader = createSectionHeader(
                title: "Waiting on others",
                dotColor: NSColor(srgbRed: 0.45, green: 0.52, blue: 0.62, alpha: 1.0),
                count: waitingCount
            )
            newItems.append(waitingHeader)
            
            if waitingPRs.isEmpty {
                let emptyWaiting = NSMenuItem(
                    title: "    No PRs currently waiting on others",
                    action: nil,
                    keyEquivalent: ""
                )
                emptyWaiting.isEnabled = false
                if let font = NSFont.systemFont(ofSize: 11, weight: .regular) as NSFont? {
                    emptyWaiting.attributedTitle = NSAttributedString(
                        string: "    No PRs currently waiting on others",
                        attributes: [.font: font, .foregroundColor: NSColor.secondaryLabelColor]
                    )
                }
                newItems.append(emptyWaiting)
            } else {
                for item in waitingPRs {
                    let prItem = createPRMenuItem(item: item, isAttention: false)
                    newItems.append(prItem)
                }
            }
        }
        
        newItems.append(NSMenuItem.separator())
        
        // -------------------------------------------------------------
        // 4. Actions: Dashboard, Refresh, Quit
        // -------------------------------------------------------------
        let dashItem = createMenuItem(title: "Open Workflow Dashboard", keyEquivalent: "d") { [weak self] in
            guard let self = self else { return }
            if let url = URL(string: "http://localhost:\(self.port)") {
                NSWorkspace.shared.open(url)
            }
        }
        if #available(macOS 11.0, *) {
            dashItem.image = NSImage(systemSymbolName: "macwindow.on.rectangle", accessibilityDescription: "Dashboard")
        }
        newItems.append(dashItem)
        
        // Custom Refresh Item that does not collapse the menu dropdown on click!
        let refreshItem = NSMenuItem()
        let refreshView = RefreshMenuItemView(
            frame: NSRect(x: 0, y: 0, width: headerWidth, height: 26),
            isRefreshing: isFetching
        ) { [weak self] in
            self?.fetchPRs()
        }
        refreshItem.view = refreshView
        newItems.append(refreshItem)
        newItems.append(NSMenuItem.separator())
        
        let quitItem = createMenuItem(title: "Quit Menu Bar Item", keyEquivalent: "q") {
            NSApplication.shared.terminate(nil)
        }
        newItems.append(quitItem)
        
        // Add new items first, then remove old items so menu is never empty and stays open
        for item in newItems {
            menu.addItem(item)
        }
        for old in oldItems {
            menu.removeItem(old)
        }
        menu.update()
    }
    
    // MARK: - Menu Item Creators
    
    private func createSectionHeader(title: String, dotColor: NSColor, count: Int) -> NSMenuItem {
        let item = NSMenuItem()
        item.isEnabled = false
        
        let str = NSMutableAttributedString()
        
        let dotAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .bold),
            .foregroundColor: dotColor
        ]
        str.append(NSAttributedString(string: "  ● ", attributes: dotAttrs))
        
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .bold),
            .foregroundColor: NSColor.labelColor
        ]
        str.append(NSAttributedString(string: "\(title.uppercased()) ", attributes: titleAttrs))
        
        let countAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        str.append(NSAttributedString(string: "(\(count))", attributes: countAttrs))
        
        item.attributedTitle = str
        return item
    }
    
    private func createPRMenuItem(item: PRWithGatesItem, isAttention: Bool) -> NSMenuItem {
        let pr = item.pr
        let repoDisplay = pr.repo_name ?? pr.repo_full_name ?? "repo"
        
        // Clean Title
        var cleanTitle = pr.title.replacingOccurrences(of: "\n", with: " ")
        if cleanTitle.count > 46 {
            cleanTitle = String(cleanTitle.prefix(43)) + "..."
        }
        
        // Attributed Title
        let attrTitle = NSMutableAttributedString()
        
        // Repo name prefix (subtle)
        let repoAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .regular),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        attrTitle.append(NSAttributedString(string: "\(repoDisplay) ", attributes: repoAttrs))
        
        // PR number (bold)
        let numAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .bold),
            .foregroundColor: NSColor.labelColor
        ]
        attrTitle.append(NSAttributedString(string: "#\(pr.number) ", attributes: numAttrs))
        
        // PR title
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .regular),
            .foregroundColor: NSColor.labelColor
        ]
        attrTitle.append(NSAttributedString(string: cleanTitle, attributes: titleAttrs))
        
        // Badges: Conflicts, Drafts
        if pr.has_merge_conflicts == true {
            let conflictAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 10.5, weight: .bold),
                .foregroundColor: NSColor.systemRed
            ]
            attrTitle.append(NSAttributedString(string: "  [⚠️ Conflict]", attributes: conflictAttrs))
        }
        
        if pr.is_draft == true {
            let draftAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 10.5, weight: .regular),
                .foregroundColor: NSColor.secondaryLabelColor
            ]
            attrTitle.append(NSAttributedString(string: " [Draft]", attributes: draftAttrs))
        }
        
        let fallbackText = "\(repoDisplay) #\(pr.number): \(cleanTitle)"
        let menuItem = NSMenuItem(title: fallbackText, action: nil, keyEquivalent: "")
        menuItem.attributedTitle = attrTitle
        
        // Icon
        if #available(macOS 11.0, *) {
            if pr.has_merge_conflicts == true {
                menuItem.image = NSImage(systemSymbolName: "exclamationmark.triangle.fill", accessibilityDescription: "Conflict")
            } else if isAttention {
                menuItem.image = NSImage(systemSymbolName: "exclamationmark.circle.fill", accessibilityDescription: "Attention")
            } else {
                menuItem.image = NSImage(systemSymbolName: "arrow.triangle.pull", accessibilityDescription: "PR")
            }
        }
        
        // Direct click opens PR in Dashboard
        let dashboardUrlStr = "http://localhost:\(port)/?selected=\(pr.number)"
        if let dashUrl = URL(string: dashboardUrlStr) {
            let target = MenuItemTarget {
                NSWorkspace.shared.open(dashUrl)
            }
            activeTargets.append(target)
            menuItem.target = target
            menuItem.action = #selector(MenuItemTarget.invoke)
        }
        
        // Rich Submenu for details
        let prSubmenu = NSMenu()
        
        // Open in Dashboard
        if let dashUrl = URL(string: dashboardUrlStr) {
            let openDashItem = createMenuItem(title: "Open in Dashboard", keyEquivalent: "") {
                NSWorkspace.shared.open(dashUrl)
            }
            if #available(macOS 11.0, *) {
                openDashItem.image = NSImage(systemSymbolName: "macwindow", accessibilityDescription: "Dashboard")
            }
            prSubmenu.addItem(openDashItem)
        }
        
        // Open in GitHub
        if let urlStr = pr.html_url, let ghUrl = URL(string: urlStr) {
            let openGHItem = createMenuItem(title: "Open in GitHub", keyEquivalent: "") {
                NSWorkspace.shared.open(ghUrl)
            }
            if #available(macOS 11.0, *) {
                openGHItem.image = NSImage(systemSymbolName: "arrow.up.right.square", accessibilityDescription: "GitHub")
            }
            prSubmenu.addItem(openGHItem)
        }
        
        prSubmenu.addItem(NSMenuItem.separator())
        
        // Author & Branch Info
        let authorStr = pr.user?.login ?? "unknown"
        let headBranch = pr.head?.ref ?? "?"
        let baseBranch = pr.base?.ref ?? "main"
        
        let authorItem = NSMenuItem(title: "Author: @\(authorStr)", action: nil, keyEquivalent: "")
        authorItem.isEnabled = false
        prSubmenu.addItem(authorItem)
        
        let branchItem = NSMenuItem(title: "Branch: \(headBranch) → \(baseBranch)", action: nil, keyEquivalent: "")
        branchItem.isEnabled = false
        prSubmenu.addItem(branchItem)
        
        if pr.is_draft == true {
            let dItem = NSMenuItem(title: "Status: Draft PR 📝", action: nil, keyEquivalent: "")
            dItem.isEnabled = false
            prSubmenu.addItem(dItem)
        }
        
        if pr.has_merge_conflicts == true {
            let cItem = NSMenuItem(title: "Status: Merge Conflicts ⚠️", action: nil, keyEquivalent: "")
            cItem.isEnabled = false
            prSubmenu.addItem(cItem)
        }
        
        // Evaluated Gates
        let passedGates = (item.evaluatedGates ?? []).filter { $0.passed == true }
        if !passedGates.isEmpty {
            prSubmenu.addItem(NSMenuItem.separator())
            let gateHeader = NSMenuItem(title: "Active Gates:", action: nil, keyEquivalent: "")
            gateHeader.isEnabled = false
            prSubmenu.addItem(gateHeader)
            
            for gate in passedGates {
                let label = gate.rule?.buttonLabel ?? gate.rule?.name ?? "Action"
                let gateItem = createMenuItem(title: "  ⚡ \(label)", keyEquivalent: "") {
                    if let dashUrl = URL(string: dashboardUrlStr) {
                        NSWorkspace.shared.open(dashUrl)
                    }
                }
                prSubmenu.addItem(gateItem)
            }
        }
        
        menuItem.submenu = prSubmenu
        return menuItem
    }
    
    private func createMenuItem(title: String, keyEquivalent: String, handler: @escaping () -> Void) -> NSMenuItem {
        let target = MenuItemTarget(handler)
        activeTargets.append(target)
        let item = NSMenuItem(title: title, action: #selector(MenuItemTarget.invoke), keyEquivalent: keyEquivalent)
        item.target = target
        return item
    }
}

// MARK: - Main Entry Point

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // Accessory: stays in menu bar, no Dock icon
let delegate = AppDelegate()
app.delegate = delegate
app.run()
