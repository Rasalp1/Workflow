import os
import subprocess
import plistlib
import time

home = os.path.expanduser('~')
project_dir = '/Users/rasmusalpsten/Drive C/Projects/Workflow'
workflow_app = os.path.join(home, 'Desktop', 'Workflow.app')
stop_app = os.path.join(home, 'Desktop', 'Stop Workflow Server.app')

# 1. Compile enhanced main.scpt for Workflow.app
workflow_scpt = """use AppleScript version "2.4"
use scripting additions
property projectDir : "/Users/rasmusalpsten/Drive C/Projects/Workflow"
property logFile : "/tmp/workflow-dev.log"

on run
	set startCmd to "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; cd " & quoted form of projectDir & " && npm run dev > " & quoted form of logFile & " 2>&1 & server_pid=$!; wait $server_pid"
	set pidCheck to ""
	try
		set pidCheck to «event sysoexec» "lsof -ti :3000 -sTCP:LISTEN"
	on error
		set pidCheck to ""
	end try
	if pidCheck is "" then
		«event sysoexec» "open http://localhost:3000"
		-- Keep the shell under this authorized applet. Do not detach it:
		-- a detached server loses the applet's Apple Events launch context.
		try
			«event sysoexec» startCmd
		on error
			-- Stop Workflow Server intentionally terminates this command.
		end try
	else
		«event sysoexec» "open http://localhost:3000"
	end if
end run
"""

stop_scpt = """use AppleScript version "2.4"
use scripting additions
on run
	set checkCmd to "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; PIDS=$(lsof -ti :3000 -sTCP:LISTEN 2>/dev/null); if [ -n $PIDS ]; then kill -9 $PIDS 2>/dev/null; fi"
	try
		«event sysoexec» checkCmd
	end try
end run
"""

if os.path.exists(workflow_app):
    scpt_path = os.path.join(workflow_app, 'Contents', 'Resources', 'Scripts', 'main.scpt')
    subprocess.run(['osacompile', '-o', scpt_path], input=workflow_scpt.encode('utf-8'), check=True)
    print(f"Compiled updated main.scpt into {workflow_app}")

if os.path.exists(stop_app):
    scpt_path = os.path.join(stop_app, 'Contents', 'Resources', 'Scripts', 'main.scpt')
    subprocess.run(['osacompile', '-o', scpt_path], input=stop_scpt.encode('utf-8'), check=True)
    print(f"Compiled updated main.scpt into {stop_app}")

# 2. Run transparent icon generator Swift script
print("Running scripts/make_transparent_icon.swift...")
subprocess.run(['swift', 'scripts/make_transparent_icon.swift'], cwd=project_dir, check=True)

# 3. Update Dock plist to clear stale bookmark and reset mod date
dock_plist_path = os.path.join(home, 'Library', 'Preferences', 'com.apple.dock.plist')
try:
    with open(dock_plist_path, 'rb') as f:
        dock_data = plistlib.load(f)
    
    modified = False
    for item in dock_data.get('persistent-apps', []):
        tile_data = item.get('tile-data', {})
        url = tile_data.get('file-data', {}).get('_CFURLString', '')
        if 'Workflow.app' in url:
            print("Found Workflow in Dock persistent-apps. Resetting bookmark & mod-dates...")
            tile_data.pop('book', None)
            tile_data['file-mod-date'] = 0
            tile_data['parent-mod-date'] = 0
            tile_data['bundle-identifier'] = 'com.workflow.app'
            tile_data['file-type'] = 1
            modified = True
            
    if modified:
        with open(dock_plist_path, 'wb') as f:
            plistlib.dump(dock_data, f, fmt=plistlib.FMT_BINARY)
        print("Updated com.apple.dock.plist successfully.")
except Exception as e:
    print(f"Dock plist update notice: {e}")

# 4. Flush system caches
print("Flushing caches and restarting system daemons...")
subprocess.run(['pkill', '-9', '-f', 'Workflow.app'], stderr=subprocess.DEVNULL)
subprocess.run(['pkill', '-9', '-f', 'Stop Workflow Server.app'], stderr=subprocess.DEVNULL)
subprocess.run(['killall', '-9', 'iconservicesagent'], stderr=subprocess.DEVNULL)

subprocess.run('find /private/var/folders -name "com.apple.dock.iconcache" -delete 2>/dev/null', shell=True)
subprocess.run('find /private/var/folders -name "*com.apple.iconservices*" -exec rm -rf {} + 2>/dev/null', shell=True)
subprocess.run(['qlmanage', '-r', 'cache'], stderr=subprocess.DEVNULL)
subprocess.run(['qlmanage', '-r'], stderr=subprocess.DEVNULL)

lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
if os.path.exists(lsregister):
    subprocess.run([lsregister, '-f', '-r', workflow_app], stderr=subprocess.DEVNULL)
    subprocess.run([lsregister, '-f', '-r', stop_app], stderr=subprocess.DEVNULL)

subprocess.run(['touch', workflow_app], check=True)
subprocess.run(['touch', stop_app], check=True)

# 5. Restart Dock and Finder with SIGKILL so no cached state is written on exit
subprocess.run(['killall', '-9', 'Dock'], stderr=subprocess.DEVNULL)
subprocess.run(['killall', '-9', 'Finder'], stderr=subprocess.DEVNULL)
print("Complete! Dock and Finder restarted.")
