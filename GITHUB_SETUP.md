# GitHub Repository Setup Guide

Your project is not yet a Git repository. Follow these steps to create one and connect it to GitHub.

## Step 1: Initialize Git Repository

Open your terminal in the project folder and run:

```bash
cd "/Users/athinageronatsiou/Desktop/UAT Scenarios Generator "
git init
```

## Step 2: Create Initial Commit

```bash
# Add all files
git add .

# Create first commit
git commit -m "Initial commit: UAT Scenarios Generator app"
```

## Step 3: Create GitHub Repository

### Option A: Using GitHub Website (Recommended for Beginners)

1. Go to https://github.com
2. Sign in (or create account if needed)
3. Click the **"+"** icon in top-right → **"New repository"**
4. Fill in:
   - **Repository name:** `UAT-Scenarios-Generator` (or `uat-scenarios-generator`)
   - **Description:** "Generate UAT test scenarios from UI screenshots using AI"
   - **Visibility:** Choose **Public** (for free GitHub Pages) or **Private**
   - **⚠️ DO NOT** check "Add a README file" (we already have one)
   - **⚠️ DO NOT** check "Add .gitignore" (we already have one)
   - **⚠️ DO NOT** choose a license (optional)
5. Click **"Create repository"**

### Option B: Using GitHub CLI (if installed)

```bash
gh repo create UAT-Scenarios-Generator --public --source=. --remote=origin --push
```

## Step 4: Connect Local Repository to GitHub

After creating the repository on GitHub, you'll see a page with setup instructions. Use the **"push an existing repository"** option:

```bash
# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/UAT-Scenarios-Generator.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/UAT-Scenarios-Generator.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME`** with your actual GitHub username!

## Step 5: Verify Connection

```bash
git remote -v
```

You should see:
```
origin  https://github.com/YOUR_USERNAME/UAT-Scenarios-Generator.git (fetch)
origin  https://github.com/YOUR_USERNAME/UAT-Scenarios-Generator.git (push)
```

## Step 6: Update Vercel Guide

Now that you have a GitHub repository, update the Vercel setup:

1. In `api/uat.ts`, update the CORS `allowedOrigins`:
   ```typescript
   const allowedOrigins = [
     'https://YOUR_USERNAME.github.io', // ← Replace with your GitHub Pages URL
     'http://localhost:5173',
     'http://localhost:3000',
   ];
   ```

2. Your GitHub Pages URL will be:
   - If repo name is `UAT-Scenarios-Generator`: `https://YOUR_USERNAME.github.io/UAT-Scenarios-Generator/`
   - If repo name is `uat-scenarios-generator`: `https://YOUR_USERNAME.github.io/uat-scenarios-generator/`

## Step 7: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll to **Pages** in left sidebar
4. Under **Source**, select:
   - **Branch:** `main` (or `gh-pages` if you prefer)
   - **Folder:** `/ (root)` or `/dist` (depending on your setup)
5. Click **Save**
6. GitHub will show your site URL (usually takes a few minutes)

## Troubleshooting

**"Repository not found" error:**
- Check that the repository name matches exactly
- Verify your GitHub username is correct
- Make sure the repository exists on GitHub

**"Permission denied" error:**
- You may need to authenticate. GitHub may prompt for credentials
- Consider using GitHub CLI: `gh auth login`
- Or use a Personal Access Token instead of password

**Can't find repository in Vercel:**
- Make sure you've authorized Vercel to access your GitHub account
- Refresh the Vercel dashboard
- Check that the repository is public (or you've given Vercel access to private repos)

## Next Steps

Once your repository is on GitHub:
1. ✅ Continue with **Step 1** in `VERCEL_SETUP_GUIDE.md`
2. ✅ Vercel will be able to find your repository
3. ✅ You can set up GitHub Pages deployment
