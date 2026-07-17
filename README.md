# MARK3085 Week 7 Tutorial App

Interactive in-class tool for integrating Display, SEO and Paid Search across
the RACE journey. Students work on their own laptops; submissions sync to a
Supabase database so the tutor board shows every group's work live.

## What is already done

- Supabase project `mark3085-tutorial` (Sydney region) is created and live.
- The `submissions` table and its access policies are set up.
- The app is wired to that database. Credentials are in `src/config.js`.

You do NOT need to touch Supabase. You only need to publish this folder.

## Publish to GitHub Pages (about 10 minutes)

The repository name matters: the app is served from
`https://<your-username>.github.io/<repo-name>/`, and the build uses the repo
name as its base path automatically. Any repo name is fine; the steps below
assume you pick one and stick with it.

1. Create a new GitHub repository (public). Note the exact name.
2. Push this folder to it. From inside this folder:

   ```bash
   git init
   git add .
   git commit -m "MARK3085 W7 tutorial app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

3. On GitHub: **Settings -> Pages -> Build and deployment -> Source**, choose
   **GitHub Actions**. (Not "Deploy from a branch".)
4. The included workflow builds and deploys on every push to `main`. Watch it
   under the **Actions** tab. First run takes 1-2 minutes.
5. When it finishes, your live URL is:
   `https://<your-username>.github.io/<repo-name>/`

That URL is what you give students.

## Test BEFORE class (do this, do not skip)

You have two cohorts back to back, so a failure mid-class is costly. Five
minutes now removes that risk.

1. Open the live URL on your laptop. Choose **I'm the tutor**, passphrase
   `13111984`. You should see the submissions board (empty).
2. On your phone (use mobile data, not the same wifi, to mimic a student
   elsewhere), open the same URL. Choose **I'm a student**, enter a test login
   like `Envato9413`.
3. On the phone, go to **RACE canvas**, type something, hit **Submit to tutor**.
   You should see "Submitted to tutor."
4. On your laptop tutor board, class **9413**, hit **Refresh**. The test entry
   should appear.
5. If it appears: you are ready. Delete the test row if you like (see below).
   If it does NOT appear: you still have the built-in fallback. Students hit
   **Copy my work** and send you the text; you paste it into the board's
   **Paste a group's work** box. The lesson runs either way.

## Group logins to hand out

Students enter their brand name (no spaces) then their class number. Spaces,
capitals and dots are forgiven.

Class 9413 (F13A): `Envato9413`, `FrankBody9413`, `PalaceCinemas9413`,
`AmberElectric9413`, `TheSomewhereCo9413`

Class 9414 (F15A): `Envato9414`, `FrankBody9414`, `PalaceCinemas9414`,
`AmberElectric9414`, `TheSomewhereCo9414`

The class number is baked into the login, so a 9413 group cannot land in the
9414 pile.

## Clearing test or old data

To wipe the table between runs or after testing, run this in the Supabase SQL
editor (Dashboard -> SQL Editor):

```sql
delete from submissions;              -- everything
delete from submissions where cls = '9413';   -- just one class
```

## Notes and honest limits

- The publishable key and the tutor passphrase are visible in the page source.
  The key only allows what the table policies permit; the passphrase just hides
  the tutor view from casual clicking. Neither is real security. Do not store
  anything sensitive here.
- Anyone with the URL can open the app and write a row. For a classroom tool
  that is fine. If you want it locked after class, pause the Supabase project
  from its dashboard, or delete the repo.
- Local preview if you want it: `npm install` then `npm run dev`.
