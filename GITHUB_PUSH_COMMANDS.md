# Step 7: Push Your Code to GitHub

You're on the GitHub repository page. Follow these exact steps:

## Commands to Run

Open your Terminal and run these commands **one by one**:

### 1. Navigate to your project folder
```bash
cd "/Users/athinageronatsiou/Desktop/UAT Scenarios Generator "
```

### 2. Initialize Git (if not done already)
```bash
git init
```

### 3. Add all your files
```bash
git add .
```

### 4. Create your first commit
```bash
git commit -m "Initial commit: UAT Scenarios Generator with Vercel API"
```

### 5. Rename branch to main (if needed)
```bash
git branch -M main
```

### 6. Add GitHub as remote
```bash
git remote add origin https://github.com/athgeronatsiou-creator/UAT-Scenarios-Generator.git
```

### 7. Push to GitHub
```bash
git push -u origin main
```

## What to Expect

- **If you're not logged in:** GitHub will prompt for credentials
  - Username: `athgeronatsiou-creator`
  - Password: Use a **Personal Access Token** (not your GitHub password)
    - Get one at: https://github.com/settings/tokens
    - Create token with `repo` scope

- **If push succeeds:** You'll see:
  ```
  Enumerating objects: X, done.
  Counting objects: 100% (X/X), done.
  Writing objects: 100% (X/X), done.
  To https://github.com/athgeronatsiou-creator/UAT-Scenarios-Generator.git
   * [new branch]      main -> main
  Branch 'main' set up to track remote branch 'main' from 'origin'.
  ```

## After Successful Push

1. **Refresh your GitHub page** - you should see all your files
2. **Continue to Step 1 in VERCEL_SETUP_GUIDE.md** - Vercel will now find your repo
3. **Update CORS in api/uat.ts** - Change the allowed origin to:
   ```typescript
   'https://athgeronatsiou-creator.github.io'
   ```

## Troubleshooting

**"remote origin already exists" error:**
```bash
git remote remove origin
git remote add origin https://github.com/athgeronatsiou-creator/UAT-Scenarios-Generator.git
```

**"Authentication failed" error:**
- Use Personal Access Token instead of password
- Create at: https://github.com/settings/tokens
- Select `repo` scope

**"Permission denied" error:**
- Make sure you're logged into GitHub
- Verify the repository name matches exactly
