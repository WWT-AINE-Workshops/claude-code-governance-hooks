# Governance and Control with Hooks

A 150-minute hands-on workshop from World Wide Technology.

This repository is your workspace for the workshop. It contains the lab guides and helper scripts, and a small sample app that the labs work on.

## Start here

Do this before the session. The full pre-work guide, with troubleshooting for every step, is [workshop/pre-work.md](workshop/pre-work.md) (also as [pre-work.docx](workshop/pre-work.docx)).

### Step 1: Install git and the GitHub CLI

**Windows users: set up WSL first.** The workshop does not run in PowerShell or CMD. Open PowerShell as an administrator (right-click it, then choose Run as administrator) and run this:

```powershell
wsl --install
```

What this does: turns on Windows Subsystem for Linux and installs Ubuntu. It needs a restart, and leaves your Windows files alone.

Restart your computer when it asks. Then open Ubuntu from the Start menu, pick a username and password, and wait for the prompt to appear. From here on, type everything in that Ubuntu window, and follow the **Linux and WSL** commands below. Microsoft's guide is at https://learn.microsoft.com/en-us/windows/wsl/install. Keep your work in your Linux home folder, not under `/mnt/c`, because it is faster and avoids permission problems.

**How to do it.**

1. Install **git**.
   - **macOS:** run `xcode-select --install`, or `brew install git` if you use Homebrew (https://brew.sh).
   - **Linux and WSL:**

     ```bash
     sudo apt-get update && sudo apt-get install -y git curl build-essential
     ```

     What this does: refreshes the list of Ubuntu packages and installs git and curl, plus the compilers some packages need. It asks for your password because it uses `sudo`.

   - Tell git who you are. Use your own name and email.

     ```bash
     git config --global user.name "Your Name"
     ```

     What this does: sets the name git puts on your commits, for every repository on this computer. It changes no files in any repository.

     ```bash
     git config --global user.email you@example.com
     ```

     What this does: sets the email address git puts on your commits, for every repository on this computer. It changes no files in any repository.

2. Install the **GitHub CLI**.
   - **macOS:** if you have Homebrew, run the command below. If you do not, either install Homebrew first from https://brew.sh (it needs administrator rights), or download the GitHub CLI installer from https://cli.github.com.

     ```bash
     brew install gh
     ```

     What this does: installs the GitHub CLI, `gh`, with Homebrew. It does not sign you in.

   - **Linux and WSL:** the official apt instructions are at https://github.com/cli/cli/blob/trunk/docs/install_linux.md. For Ubuntu and Debian, paste this whole block as one command:

     ```bash
     (type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) && sudo mkdir -p -m 755 /etc/apt/keyrings && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg && cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && sudo mkdir -p -m 755 /etc/apt/sources.list.d && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh -y
     ```

     What this does: adds GitHub's package source and its signing key to apt, then installs `gh`. It asks for your password because it uses `sudo`, and it does not sign you in.

3. Open a **new terminal window** so your shell picks up the changes, then check each tool.

   ```bash
   git --version
   ```

   What this does: prints the version of git on your PATH. It changes nothing.

   ```bash
   gh --version
   ```

   What this does: prints the version of `gh`. It changes nothing.

### Step 2: Sign in to GitHub

**How to do it.**

1. Sign in to GitHub. Run this and answer the prompts. Choose **GitHub.com**, then **HTTPS**. When it asks "Authenticate Git with your GitHub credentials?", answer **Yes**. Then choose to sign in with a **web browser**. `gh` shows a one-time code and waits for you to press Enter before it opens your browser. Type the code there. If no browser opens (common in WSL), copy the URL that `gh` prints into a browser on Windows.

   ```bash
   gh auth login
   ```

   What this does: signs the GitHub CLI in to your GitHub account and stores its token on this computer. Because you answer yes to authenticating git, git uses it too when it pushes. It changes no repository.

2. Check that it worked.

   ```bash
   gh auth status
   ```

   What this does: shows which GitHub account `gh` is signed in to. It changes nothing.

### Step 3: Install Node.js

**How to do it.** Install **Node.js 24 LTS** (24.15 or later). Node 22 (22.22.2 or later) and Node 26 also pass the check, but 24 is the one we tested. On Windows, run these in your Ubuntu window and use the Linux and WSL command.

- **macOS:** download the installer from https://nodejs.org/en/download, or with Homebrew run these two commands:

  ```bash
  brew install node@24
  ```

  What this does: installs Node 24, with its npm, with Homebrew. It does not remove any other Node you have.

  ```bash
  brew link --overwrite --force node@24
  ```

  What this does: puts that Node 24 on your PATH, in place of whichever Node Homebrew linked before. It changes no project files.

- **Linux and WSL:** the Node.js download page offers nvm, a small tool that installs Node for you. Copy the current nvm command from https://nodejs.org/en/download, which looks like this:

  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
  ```

  What this does: installs nvm in your home folder and adds it to your shell's start-up file. It installs no Node yet.

  Close the terminal and open a new one. Then install Node:

  ```bash
  nvm install 24
  ```

  What this does: downloads Node 24, with its npm, into nvm's folder and makes it the one your terminal uses.

Open a **new terminal window**, then check it.

```bash
node --version
```

What this does: prints the version of Node on your PATH. It changes nothing.

Check npm too. It comes with Node, and the workshop needs npm 11 or later.

```bash
npm --version
```

What this does: prints the version of npm on your PATH. It changes nothing.

If it prints a number below 11, which is usual with Node 22, update npm:

```bash
npm install -g npm@11
```

What this does: replaces the npm that came with this Node with npm 11. It changes no project files, and leaves Node itself alone.

### Step 4: Install Claude Code and sign in

The labs use Claude Code in the **Claude desktop app's Code tab**. The desktop app and the command-line version read the same settings files, so the hooks you write work in both.

1. Install the Claude desktop app for macOS or Windows from https://claude.ai/download, open it, sign in, and open the **Code tab**. On Windows, run the desktop app in Windows and everything else in WSL. On Linux there is no desktop app: use the command-line version below, and follow the labs' "In the CLI" lines.

2. Optional, but recommended on macOS and Windows, and needed on Linux: install the command-line version.

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

   What this does: downloads Anthropic's installer and installs Claude Code for your user account only. It changes no repository.

   Open a new terminal window, check it with `claude --version`, then run `claude` once to sign in. Leave it with `Ctrl+D` twice on an empty prompt.

3. If Claude Code asks whether you trust a folder, that is its workspace trust dialog. Say yes for a folder you made. In the Code tab, use a local session in your copy of this repository: cloud sessions do not read your local settings files, so the lab's hooks would not run.

### Step 5: Make your copy of the workshop repository

**How to do it.** Run these two commands, one at a time, in the folder where you want the project to live. On WSL, that is your Linux home folder.

1. Clone the workshop repository into a folder called `my-claude-code-governance-hooks`.

   ```bash
   git clone https://github.com/WWT-AINE-Workshops/claude-code-governance-hooks.git my-claude-code-governance-hooks
   ```

   What this does: downloads the workshop repository, with its full history and its lab starting points, into a new folder called `my-claude-code-governance-hooks`. Nothing else on your computer changes.

2. Move into the folder.

   ```bash
   cd my-claude-code-governance-hooks
   ```

   What this does: moves your terminal into that folder. It changes nothing.

Stay in the `my-claude-code-governance-hooks` folder for every step below. Now choose one of two paths.

**Quick: run the setup script.**

```bash
./scripts/setup-workshop.sh
```

What this does: walks you through the rest of the pre-work. It makes your private copy on GitHub, installs the app and its tools, and checks your setup. If the workshop has GitHub issues for the labs, it also creates its labels and issues in your copy, and makes your copy the repository `gh` uses in this folder. Before each step it says what the step changes, then asks `Run it? [Y/n]`, so you can skip any step and do it by hand. It installs no tools and never asks for a password of its own, though git may ask you to sign in when it pushes. To answer yes to every question, run `./scripts/setup-workshop.sh --yes` instead.

When it ends with `Setup finished.`, the pre-work is done. If it ends with `Setup finished, with skipped steps:`, or stops on a step, do those steps by hand below.

**By hand.** Run these two commands, then carry on with the next step.

3. Remove the link back to the workshop repository.

   ```bash
   git remote remove origin
   ```

   What this does: deletes only your clone's pointer to the workshop's GitHub URL, which git calls `origin`. No commits, branches, tags or files are removed. The next command sets `origin` again, to your own private repository.

4. Create your private copy on GitHub and push to it.

   ```bash
   gh repo create my-claude-code-governance-hooks --private --source . --remote origin --push
   ```

   What this does: creates a private repository called `my-claude-code-governance-hooks` in your GitHub account, points `origin` at it and pushes your current branch, `main`, with its full history. It does not push the lab starting points: they stay in your clone, and the reset script fetches any that are missing from the workshop's URL.

### Step 6: Check your setup

**How to do it.** The setup script runs this check for you. On the by-hand path, run it in the `my-claude-code-governance-hooks` folder, then read the output. Each line starts with a mark: a tick means ready, a warning means fix it if you can, a cross means it must be fixed.

```bash
./scripts/check-setup.sh
```

What this does: only reads and reports. It checks your tools, their versions and the ports the app needs, and changes nothing.

The script may warn that a program is not set up until the next steps, or that a port the app needs is in use. Fix a busy port by closing the program that uses it.

### Step 7: Install the app and its tools

**How to do it.** The setup script does this step for you. On the by-hand path, run these one at a time, from the `my-claude-code-governance-hooks` folder. The first can take a few minutes.

1. Install the project's packages with `npm ci`, which installs exactly what the lock file lists and never changes it, so your copy stays clean for `./scripts/reset-lab.sh`. npm may warn about install scripts. That is harmless.

   ```bash
   npm ci
   ```

   What this does: installs the exact package versions from `package-lock.json` into `node_modules`, without changing the lock file or any other file git tracks.

2. Set up the app's data.

   ```bash
   npm run setup
   ```

   What this does: runs one of the app's setup commands, which prepares it for the labs (for example its local data). It changes no file git tracks.

Run the check again.

```bash
./scripts/check-setup.sh
```

What this does: only reads and reports, as before. It changes nothing.

## Open the workshop guide

**[workshop/README.md](workshop/README.md)** has the agenda and links to every lab.

Fell behind during the session? `./scripts/reset-lab.sh <lab number>` puts you at the start of any lab.

---
