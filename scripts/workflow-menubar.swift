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
}

struct ApiResponse: Decodable {
    let success: Bool?
    let currentUser: String?
    let prsWithGates: [PRWithGatesItem]?
    let monitoredRepos: [String]?
    let error: String?
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
    
    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            if #available(macOS 11.0, *) {
                let symbolConfig = NSImage.SymbolConfiguration(pointSize: 13, weight: .medium)
                if let image = NSImage(systemSymbolName: "arrow.triangle.pull", accessibilityDescription: "Pull Requests")?.withSymbolConfiguration(symbolConfig) {
                    image.isTemplate = true
                    button.image = image
                } else {
                    button.title = "PR"
                }
            } else {
                button.title = "PR"
            }
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
        // If it's been more than 10 seconds since last fetch, refresh when opening menu
        if let last = lastFetchTime, Date().timeIntervalSince(last) > 10 {
            fetchPRs()
        } else if lastFetchTime == nil {
            fetchPRs()
        }
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
    
    private func updateStatusBarBadge(offline: Bool = false, error: Bool = false) {
        guard let button = statusItem.button else { return }
        
        if offline {
            button.title = " ⚠️"
            button.toolTip = "Workflow: Server offline (localhost:\(port))"
            return
        }
        
        if error {
            button.title = " !"
            button.toolTip = "Workflow: Error reading PR data"
            return
        }
        
        let prCount = latestData?.prsWithGates?.count ?? 0
        button.title = prCount > 0 ? " \(prCount)" : ""
        button.toolTip = "Workflow: \(prCount) open pull request\(prCount == 1 ? "" : "s")"
    }
    
    // MARK: - Menu Rendering
    
    private func renderMenu() {
        menu.removeAllItems()
        activeTargets.removeAll()
        
        let prs = latestData?.prsWithGates ?? []
        let user = latestData?.currentUser ?? "User"
        
        // 1. Header item
        let headerItem = NSMenuItem(title: "Workflow", action: nil, keyEquivalent: "")
        headerItem.isEnabled = false
        if let font = NSFont.systemFont(ofSize: 13, weight: .bold) as NSFont? {
            headerItem.attributedTitle = NSAttributedString(string: "Workflow", attributes: [.font: font])
        }
        menu.addItem(headerItem)
        
        if isOffline {
            let statusItem = NSMenuItem(title: "  ● Server offline (localhost:\(port))", action: nil, keyEquivalent: "")
            statusItem.isEnabled = false
            menu.addItem(statusItem)
        } else {
            let statusItem = NSMenuItem(title: "  ● Logged in as @\(user)", action: nil, keyEquivalent: "")
            statusItem.isEnabled = false
            menu.addItem(statusItem)
        }
        
        menu.addItem(NSMenuItem.separator())
        
        // 2. PR List section
        let sectionTitle = isOffline 
            ? "Pull Requests (Server Offline)" 
            : "Pull Requests (\(prs.count))"
        let prSectionItem = NSMenuItem(title: sectionTitle, action: nil, keyEquivalent: "")
        prSectionItem.isEnabled = false
        if let font = NSFont.systemFont(ofSize: 11, weight: .semibold) as NSFont? {
            prSectionItem.attributedTitle = NSAttributedString(string: sectionTitle, attributes: [.font: font, .foregroundColor: NSColor.secondaryLabelColor])
        }
        menu.addItem(prSectionItem)
        
        if prs.isEmpty {
            let emptyItem = NSMenuItem(
                title: isOffline ? "Waiting for server connection..." : "No open pull requests 🎉",
                action: nil,
                keyEquivalent: ""
            )
            emptyItem.isEnabled = false
            menu.addItem(emptyItem)
        } else {
            for item in prs {
                let pr = item.pr
                let repoDisplay = pr.repo_name ?? pr.repo_full_name ?? "repo"
                
                // Truncate title cleanly if long
                var cleanTitle = pr.title.replacingOccurrences(of: "\n", with: " ")
                if cleanTitle.count > 48 {
                    cleanTitle = String(cleanTitle.prefix(45)) + "..."
                }
                
                let draftTag = (pr.is_draft == true) ? " [Draft]" : ""
                let conflictTag = (pr.has_merge_conflicts == true) ? " ⚠️" : ""
                let prItemTitle = "\(repoDisplay) #\(pr.number): \(cleanTitle)\(draftTag)\(conflictTag)"
                
                let prMenuItem = NSMenuItem(title: prItemTitle, action: nil, keyEquivalent: "")
                
                // Create submenu for each PR
                let prSubmenu = NSMenu()
                
                // Direct open GitHub
                if let urlStr = pr.html_url, let url = URL(string: urlStr) {
                    let openGHItem = createMenuItem(title: "Open in GitHub", keyEquivalent: "") {
                        NSWorkspace.shared.open(url)
                    }
                    if #available(macOS 11.0, *) {
                        openGHItem.image = NSImage(systemSymbolName: "arrow.up.right.square", accessibilityDescription: "GitHub")
                    }
                    prSubmenu.addItem(openGHItem)
                    
                    // Main click on item also opens in GitHub
                    prMenuItem.target = openGHItem.target
                    prMenuItem.action = openGHItem.action
                }
                
                // Open in Dashboard
                let dashboardUrlStr = "http://localhost:\(port)/?selected=\(pr.number)"
                if let dashUrl = URL(string: dashboardUrlStr) {
                    let openDashItem = createMenuItem(title: "Open in Dashboard", keyEquivalent: "") {
                        NSWorkspace.shared.open(dashUrl)
                    }
                    if #available(macOS 11.0, *) {
                        openDashItem.image = NSImage(systemSymbolName: "macwindow", accessibilityDescription: "Dashboard")
                    }
                    prSubmenu.addItem(openDashItem)
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
                
                prMenuItem.submenu = prSubmenu
                menu.addItem(prMenuItem)
            }
        }
        
        menu.addItem(NSMenuItem.separator())
        
        // 3. Actions section
        let dashItem = createMenuItem(title: "Open Workflow Dashboard", keyEquivalent: "d") { [weak self] in
            guard let self = self else { return }
            if let url = URL(string: "http://localhost:\(self.port)") {
                NSWorkspace.shared.open(url)
            }
        }
        if #available(macOS 11.0, *) {
            dashItem.image = NSImage(systemSymbolName: "globe", accessibilityDescription: "Dashboard")
        }
        menu.addItem(dashItem)
        
        let refreshItem = createMenuItem(title: "Refresh PRs Now", keyEquivalent: "r") { [weak self] in
            self?.fetchPRs()
        }
        if #available(macOS 11.0, *) {
            refreshItem.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "Refresh")
        }
        menu.addItem(refreshItem)
        
        menu.addItem(NSMenuItem.separator())
        
        // 4. Quit
        let quitItem = createMenuItem(title: "Quit Menu Bar Item", keyEquivalent: "q") {
            NSApplication.shared.terminate(nil)
        }
        menu.addItem(quitItem)
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
app.setActivationPolicy(.accessory) // Accessory: no Dock icon, stays in menu bar
let delegate = AppDelegate()
app.delegate = delegate
app.run()
