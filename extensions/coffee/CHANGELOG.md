# Changelog

All notable changes to the Coffee extension will be documented in this file.

---

## [Cross-Platform Edition] - 2026-01-20

### Author
@Visual-Studio-Coder (Sebastian Gomez)

### Added - Windows Support

#### New Files
- **`src/utils.ts`** - Platform detection router (~76 lines)
  - Detects operating system (Windows/macOS)
  - Dynamically loads appropriate implementation
  - Re-exports unified API for cross-platform compatibility

- **`src/utils-windows.ts`** - Windows implementation (~200 lines)
  - Uses PowerShell commands and SetThreadExecutionState API
  - Prevents system sleep on Windows
  - Supports all features: duration, time-based, app-while-running, scheduling
  - Status bar integration for Windows

- **`src/utils-macos.ts`** - macOS implementation (renamed from `utils.ts`, ~151 lines)
  - Original implementation preserved
  - Uses native `/usr/bin/caffeinate` command
  - Zero functional changes

#### Platform Detection Logic
```typescript
const platform = os.platform();
if (platform === "win32") {
  // Load Windows implementation (PowerShell)
} else if (platform === "darwin") {
  // Load macOS implementation (caffeinate)
}
```

### Changed - Cross-Platform Messaging

#### Updated Files (17)
All user-facing text updated from "Mac" to "computer" to reflect cross-platform nature:

**Documentation:**
- `README.md` - Added "Works on macOS and Windows"
- `package.json` - Main description, commands, tools, AI examples

**Source Files:**
- `src/caffeinate.ts`
- `src/decaffeinate.ts`
- `src/caffeinateToggle.ts`
- `src/caffeinateFor.tsx`
- `src/caffeinateUntil.ts`
- `src/index.tsx`

**Tools:**
- `src/tools/caffeinate.ts`
- `src/tools/caffeinate-for.ts`
- `src/tools/decaffeinate.ts`
- `src/tools/check-caffeination-status.ts`
- `src/tools/caffeinate-while-app-is-running.ts`

### Enhanced - User Experience

#### Toast & HUD Messages with Emojis

**Success Messages:**
- ☕ "Your computer is now caffeinated!"
- 💤 "Your computer is now decaffeinated"
- ☕ "Caffeinating your computer for X"
- ⏰ "Caffeinating your computer until X"
- ✅ "Caffeination schedule set successfully!"
- 🗑️ "Schedule deleted successfully!"
- ⏸️ "Schedule paused"
- ▶️ "Schedule resumed"

**Error Messages:**
- ⏱️ "No values set for caffeinate duration"
- 🔢 "Please ensure all arguments are whole numbers"
- ⏸️ "Caffeination schedule is running - pause it to decaffeinate"
- ⏰ "Unrecognized time format - use HH:MM or H:MM AM/PM"
- ⏰ "Invalid time - please use HH:MM or H:MM AM/PM"
- ❌ "Failed to set schedule - please try again"
- ❌ "Failed to delete schedule - please try again"
- ⏰ "Oops! Please specify both 'from' and 'to' times in HH:MM format"
- 📅 "Oops! Please mention the days to be excluded"

#### Emoji Legend
| Emoji | Meaning |
|-------|---------|
| ☕ | Caffeination activated |
| 💤 | Decaffeination / Sleep allowed |
| ⏰ | Time-based operations |
| ⏱️ | Duration operations |
| ✅ | Success |
| ❌ | Errors |
| 🗑️ | Deletion |
| ⏸️ | Pause |
| ▶️ | Resume |
| 🔢 | Number validation |
| 📅 | Calendar/Days |

### Features Summary

**macOS Users:**
- ✅ All original features preserved
- ✅ Native caffeinate command
- ✅ Zero performance impact
- ✅ Backward compatible

**Windows Users:**
- 🆕 Caffeinate / Decaffeinate
- 🆕 Caffeinate For (duration)
- 🆕 Caffeinate Until (time)
- 🆕 Caffeinate While (app running)
- 🆕 Schedule Management
- 🆕 Status Bar Integration

### Technical Details

**Total Changes:**
- New files: 3
- Modified files: 17 (messaging only)
- New code: ~275 lines
- Breaking changes: 0

**Testing:**
- ✅ Compiles successfully
- ✅ No TypeScript errors
- ✅ All entry points build
- ✅ Tested on macOS Ventura+
- ⚠️  Windows testing recommended

### Design Principles

**Message Enhancements:**
1. Consistency - Same emoji for same action type
2. Clarity - Emojis enhance, not replace text
3. Subtlety - One emoji per message
4. Relevance - Each emoji relates to its message
5. Accessibility - Clear even without emoji support

**Cross-Platform:**
1. Zero breaking changes
2. 100% backward compatible
3. Same API across platforms
4. Platform-specific optimizations
5. Native implementations where possible

### License
MIT (unchanged)

### Credits
- Original Coffee extension by @mooxl and contributors
- Cross-platform support and UX enhancements by @Visual-Studio-Coder

---

## Previous Versions

See original repository at https://github.com/raycast/extensions/tree/main/extensions/coffee for earlier version history.

17:01:54 Failed to reset execution state: <ref *1> Error: spawnSync cmd.exe ETIMEDOUT
    at Object.spawnSync (node:internal/child_process:1120:20)
    at spawnSync (node:child_process:901:24)
    at execSync (node:child_process:982:15)
    at stopCaffeinate (C:\Users\test\.config\raycast-x\extensions\coffee\caffeinate.js:264:46)
    at async startCaffeinate (C:\Users\test\.config\raycast-x\extensions\coffee\caffeinate.js:109:3)
    at async caffeinate_default (C:\Users\test\.config\raycast-x\extensions\coffee\caffeinate.js:8203:3) {
  errno: -4039,
  code: 'ETIMEDOUT',
  syscall: 'spawnSync cmd.exe',
  path: 'cmd.exe',
  spawnargs: [
    '/d',
    '/s',
    '/c',
    '"powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "C:\\Users\\test\\AppData\\Local\\Temp\\raycast-coffee-reset-99076160-4b29-44cb-9da4-016e445164d0.ps1""'
  ],
  error: [Circular *1],
  status: null,
  signal: 'SIGTERM',
  output: [ null, null, null ],
  pid: 9844,
  stdout: null,
  stderr: null
}