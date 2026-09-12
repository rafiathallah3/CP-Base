# CPBase - Competitive Programming Solutions Sync for GitHub

**CPBase** is a cross-browser extension for **Google Chrome** and **Mozilla Firefox** that automatically syncs accepted solutions from **Codeforces** and **TLX Toki** (`tlx.toki.id`) to your personal GitHub repository.

---

## Features

- **Cross-Browser Native**: Built on Manifest V3 with [WXT](https://wxt.dev/) — single codebase that targets both Chrome and Firefox out of the box.
- **Serverless & Private**: Connects directly to GitHub via your own **Personal Access Token (PAT)**. No middleman servers, no external databases, 100% private.
- **Rich Problem Structure**: Every solved problem is committed to GitHub with:
  - `Solution.{cpp|py|java|...}`: Clean source code.
  - `README.md`: Problem description, tags, rating/difficulty, time/memory limits, and submission details.
  - `metadata.json`: Machine-readable metadata for easy programmatic processing or static portfolios.
- **Automated Summary Index**: Automatically maintains a sorted problem table and platform badges in the repository's root `README.md`.
- **Dual Triggering**:
  - **Automatic**: Detects accepted verdicts in real time.
  - **Manual In-Page Button**: Adds a convenient *"Sync to GitHub"* button directly onto Codeforces problem headers and TLX Toki problem views.

---

## Directory Structure in GitHub

When you solve a problem, CPBase organizes your repository like this:

```text
my-solutions-repo/
├── README.md                      # Auto-maintained index table with badges
├── Codeforces/
│   └── 1900/
│       └── 1900A - Line Trip/
│           ├── Solution.cpp
│           ├── README.md          # Formatted problem statement & test cases
│           └── metadata.json      # Structured machine-readable details
└── TLX/
    └── Contest-troc-30/
        └── troc-30-a/
            ├── Solution.cpp
            ├── README.md
            └── metadata.json
```

---

## Getting Started

### 1. Development & Building

Ensure you have [Node.js](https://nodejs.org/) installed:

```bash
# Install dependencies
npm install

# Build for both Chrome and Firefox
npm run build:all

# Or build individually
npm run build          # Builds Chrome MV3 to .output/chrome-mv3
npm run build:firefox  # Builds Firefox MV3 to .output/firefox-mv3
```

For live development with hot reload:

```bash
npm run dev          # Starts Chrome with extension auto-reloading
npm run dev:firefox  # Starts Firefox with extension auto-reloading
```

---

## How to Load the Extension in Browsers

### In Google Chrome (or Edge / Brave / Chromium)
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `.output/chrome-mv3` folder inside this project directory.

### In Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the `.output/firefox-mv3` folder.

---

## Configuration in Popup

1. Click the **CPBase** extension icon in your browser toolbar.
2. In the **Settings** tab:
   - Click **Create token** to generate a GitHub Personal Access Token with the `repo` scope.
   - Paste the token and click **Connect**.
   - Select your target repository from the dropdown, or click **New repo** to have CPBase create one automatically.
   - Enter your **Codeforces Handle** (e.g., `tourist`) so CPBase can fetch your accepted contest submissions.
3. Done! Solve any problem on Codeforces or TLX Toki, or click the **Sync to GitHub** button on the problem page to test.
