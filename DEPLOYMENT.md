# 🚀 AI Water Billing System — 100% Free Deployment Guide

This guide walks you through deploying the **AI Water Billing System** for **100% Free** using a professional hybrid hosting structure:

- **Frontend (React):** Hosted on **Vercel** (Global Edge CDN, completely free tier).
- **Database (PostgreSQL):** Hosted on **Supabase** or **Neon.tech** (Persistent, 100% free serverless database).
- **Backend (Django):** Hosted on **Render** (Free tier web service).

---

## 🛠️ Step 1: Create a Free PostgreSQL Database

We use **Supabase** or **Neon.tech** for the database because their free tiers are persistent and never expire (unlike Render's free DB which is deleted after 90 days).

### Option A: Supabase (Recommended)
1. Sign up for a free account at [Supabase](https://supabase.com/).
2. Create a new project named `ai-water-billing`.
3. Set your Database Password and choose a region close to you.
4. Once created, go to **Project Settings** -> **Database**.
5. Copy the **Connection URI** string. It will look like this:
   `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres`

### Option B: Neon.tech
1. Sign up at [Neon](https://neon.tech/).
2. Create a new project.
3. Copy the **Connection String** from the dashboard.

---

## 🛠️ Step 2: Deploy Django Backend to Render

Render will host the Django server. Because it's on the free tier, we will run Celery tasks synchronously using `CELERY_TASK_ALWAYS_EAGER=True` (which we've already configured for you!), saving you from needing a paid background worker or Redis instance.

1. Go to [Render](https://render.com/) and sign in with your GitHub account.
2. Click **New +** -> **Web Service**.
3. Select the `ai-water-billing` repository.
4. Configure the Web Service:
   - **Name:** `water-billing-api`
   - **Environment:** `Python 3` (or Docker if preferred, but Python 3 is faster to build)
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn config.wsgi:application`
   - **Instance Type:** `Free`
5. Click **Advanced** and add the following **Environment Variables**:
   - `DEBUG`: `False`
   - `DJANGO_SECRET_KEY`: *(Generate a secure key, e.g., using `generate_keys.py` or a random string)*
   - `DB_ENGINE`: `django.db.backends.postgresql`
   - `DB_NAME`: *(Database name from Step 1)*
   - `DB_USER`: *(Database user from Step 1)*
   - `DB_PASSWORD`: *(Database password from Step 1)*
   - `DB_HOST`: *(Database host/server from Step 1)*
   - `DB_PORT`: `5432`
   - `ALLOWED_HOSTS`: `localhost,127.0.0.1,water-billing-api.onrender.com` *(Replace `water-billing-api` with your actual Render service name)*
   - `CELERY_TASK_ALWAYS_EAGER`: `True`
   - `FIELD_ENCRYPTION_KEY`: *(Generate a secure 32-byte urlsafe base64 key)*
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
6. Click **Create Web Service**. 
7. Once successfully built, copy the public URL Render gives you (e.g., `https://water-billing-api.onrender.com`).

### 📦 Run Django Database Migrations
1. In your Render Web Service dashboard, go to the **Shell** tab (or **Manual Deploy** -> **Run a one-off job**).
2. Run this command to initialize your database tables:
   ```bash
   python manage.py migrate
   ```
3. Create an admin user:
   ```bash
   python manage.py createsuperuser
   ```

---

## 🛠️ Step 3: Deploy React Frontend to Vercel

1. Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
2. Click **Add New** -> **Project**.
3. Import your `ai-water-billing` repository.
4. Configure the Project:
   - **Framework Preset:** `Create React App` (or Vite)
   - **Root Directory:** `frontend`
5. Click **Environment Variables** and add:
   - `REACT_APP_API_URL`: *(Your backend Render URL from Step 2, e.g., `https://water-billing-api.onrender.com`)*
6. Click **Deploy**.
7. Vercel will build your app and give you a beautiful, live production URL!

---

## 🔒 Step 4: Allow Frontend CORS on Backend

To ensure the Vercel frontend can communicate with the Render API:
1. Copy your Vercel URL (e.g., `https://ai-water-billing.vercel.app`).
2. Go back to your Render Web Service dashboard.
3. In the environment variables, update `ALLOWED_HOSTS` to include your Vercel domain name (without `https://`):
   - Example: `water-billing-api.onrender.com,ai-water-billing.vercel.app`
4. Save the changes. Render will automatically redeploy, and your app is fully live!
