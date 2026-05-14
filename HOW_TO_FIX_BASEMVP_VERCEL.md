# Fix basemvp.vercel.app so it shows the latest app (plain steps)

Your code on GitHub is already updated. If the website still shows **“best day to post”** and **times**, the problem is almost always **Vercel’s settings**, not your computer.

Do this once on a laptop or desktop (easier than a phone).

---

## Part 1 — Tell Vercel where the app lives (about 3 minutes)

1. Open **https://vercel.com** and sign in.
2. Click your project that powers **basemvp.vercel.app** (name might be `basemvp` or similar).
3. Open **Settings** (gear), then **General**.
4. Find **Root Directory**:
   - **Best option:** leave it **empty** (delete any path, save).  
     A file named **`vercel.json`** was added at the **top** of your GitHub repo so Vercel can build the app from `projects/premiyerx/base_mvp` automatically.
   - **Alternative:** set Root Directory to exactly:  
     `projects/premiyerx/base_mvp`  
     (no leading slash, no spaces). Then save.
5. Open **Settings → Git** and confirm:
   - **Repository** is **`premiyerx/cursor-sdlc-workshop`** (or your fork that receives these commits).
   - **Production branch** is **`main`**.
6. Open the **Deployments** tab, click the **⋯** menu on the latest row, choose **Redeploy** (use “Use existing Build Cache” **off** / unchecked if you see it).

Wait until the deployment shows **Ready**.

---

## Part 2 — Check that it worked

1. Open **https://basemvp.vercel.app** in a **private / incognito** window.
2. Scroll to the bottom. You should see a line like **Deploy: abc1234** (short code). That code should match the start of the latest commit on GitHub for that deployment.
3. You should **not** see **“best day to post”** or the old **7:30 AM** time pills in the greeting area.

---

## Part 3 — On your phone (if it still looks old)

Phones keep old copies longer.

- **iPhone Safari:** Settings → Safari → **Clear History and Website Data** (or remove only data for that site under Advanced → Website Data).
- **Chrome Android:** Chrome menu → History → **Clear browsing data** → Cached images (and optionally cookies) for “All time”, or use **Incognito** and open the URL again.

Then open **https://basemvp.vercel.app** again.

---

## If it still fails

In Vercel → **Deployments** → open the latest deployment → **Building** logs.  
If you see errors about `cd projects/premiyerx/base_mvp`, your **Root Directory** is probably set to the subfolder **and** the top-level `vercel.json` is conflicting. Fix by **clearing Root Directory** (empty) and redeploy again.

---

## Who to ask for help

Anyone with access to your **Vercel account** and this **GitHub repo** can verify Parts 1–2 in a few minutes.
