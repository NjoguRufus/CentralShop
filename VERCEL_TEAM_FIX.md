# Setting Up Vercel as Personal Account (Not Team)

## Goal
Deploy this project to Vercel using your **personal account** (not a team/organization).

## Setup Steps

### Step 1: Login to Vercel CLI (Personal Account)

```bash
vercel login
```

When prompted:
- Visit the URL shown in the terminal
- Login with your personal Vercel account (astraronixsolutions@gmail.com)
- Make sure you're logged into your **personal account**, not a team

### Step 2: Link Project to Personal Account

```bash
vercel link
```

When prompted:
- **Scope**: Select your **personal account** (your email/username), NOT "Astraronix Solutions" team
- **Project name**: Accept default or enter a name
- **Directory**: Accept default (./)
- **Override settings**: Usually "No" unless you need custom settings

### Step 3: Verify Personal Account Connection

After linking, verify it's connected to your personal account:

```bash
vercel ls
```

This should show your project under your personal account, not under a team.

### Step 4: Deploy to Vercel

```bash
# Deploy to preview
vercel

# Or deploy to production
vercel --prod
```

## Alternative: Link via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. **Important**: Make sure you're in your **personal account** (check top-left - should show your name/email, NOT "Astraronix Solutions")
3. If you see a team selected, click on it and switch to your personal account
4. Click **Add New** → **Project**
5. Import your GitHub repository
6. Make sure it shows your **personal account** as the owner (not a team)

## Verify GitHub Connection (Personal Account)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Settings** → **Git**
2. Under **GitHub**, verify your **personal GitHub account** (astraronixsolutions) is connected
3. If not connected:
   - Click **Connect** next to GitHub
   - Authorize Vercel to access your **personal GitHub account**
   - Make sure you're connecting your personal account, not an organization

## Quick Setup Command Sequence

```bash
# 1. Login to personal account
vercel login

# 2. Link project (select personal account when prompted)
vercel link

# 3. Deploy
vercel --prod
```

## Verification Checklist

After setup, verify:
- ✅ Run `vercel ls` - project should appear under your personal account
- ✅ Check Vercel Dashboard - project should be in your personal account (not under a team)
- ✅ Check `.vercel/project.json` - should contain your personal account ID (not a team ID)
- ✅ GitHub repo is connected to your personal Vercel account

## Troubleshooting

### Issue: Still seeing team in CLI prompts
**Solution**: Make sure you select your **personal account** (your email/username) when prompted for scope, not the team name.

### Issue: Project appears under team in dashboard
**Solution**: 
- Unlink: `vercel unlink`
- Relink and make sure to select your personal account as the scope

### Issue: Can't see personal account option
**Solution**: 
- Make sure you're logged in with your personal account: `vercel login`
- Check that you're not only a member of teams - you should have a personal account too

