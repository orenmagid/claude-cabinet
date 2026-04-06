# Setting Up GitHub for Feedback

This is optional. Claude Cabinet saves your feedback locally even
without GitHub. But if you want your feedback to go directly to the
developer who maintains the tools you're using, setting up GitHub
lets that happen automatically.

This takes about 10 minutes, and you only do it once.

## What is GitHub?

GitHub is where developers store and collaborate on code. Claude
Cabinet lives on GitHub. When you set up a GitHub account, your feedback
can be posted there as an "issue" — basically a message the developer
sees in their project dashboard.

## Step 1: Create a GitHub account

Go to [github.com](https://github.com) and click **Sign up**. You'll
need an email address. The free plan is all you need.

## Step 2: Install the GitHub CLI

The GitHub CLI (`gh`) is a small program that lets Claude send feedback
on your behalf. Open Terminal and run:

```bash
brew install gh
```

If you don't have Homebrew (the installer would have set it up for you
if you used the Claude Cabinet installer), run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then try `brew install gh` again.

## Step 3: Log in

In Terminal, run:

```bash
gh auth login
```

It will ask you a few questions:

1. **Where do you use GitHub?** Choose `GitHub.com`
2. **Preferred protocol?** Choose `HTTPS`
3. **Authenticate with?** Choose `Login with a web browser`
4. It will give you a code and open your browser. Paste the code,
   click authorize, and you're done.

## Step 4: That's it

Next time Claude finds friction with a tool and you confirm the
feedback, it will automatically post it as a GitHub issue. The
developer gets notified and can fix it.

## Checking your setup

To verify everything is working, run:

```bash
gh auth status
```

You should see something like "Logged in to github.com as yourname."

## Sending saved feedback

If you had feedback saved locally before setting up GitHub, you can
ask Claude to send it. In Claude Code, say:

> "I set up GitHub. Can you send any saved feedback from my outbox?"

Claude will read `~/.claude/cor-feedback-outbox.json` and post each
pending item as a GitHub issue.
