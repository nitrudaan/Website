# UDAAN Email Service Setup

## Using EmailJS - 200 emails/month FREE

EmailJS is a simple client-side email service that allows sending emails directly from the browser without a backend server.

---

## Step 1: Create EmailJS Account

1. Go to **https://www.emailjs.com**
2. Click **"Sign Up Free"**
3. Verify your email address
4. Complete account setup

---

## Step 2: Add Email Service

1. In the EmailJS dashboard, go to **Email Services**
2. Click **"Add New Service"**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the connection steps
5. Note down the **Service ID** (e.g., `service_xxxxxxx`)

---

## Step 3: Create Email Template

1. Go to **Email Templates**
2. Click **"Create New Template"**
3. Design your verification email template with these variables:
   - `{{to_email}}` - Recipient email
   - `{{to_name}}` - Recipient name
   - `{{verification_code}}` - 6-digit code

Example template content:
```
Subject: UDAAN Verification Code

Hi {{to_name}},

Your verification code is: {{verification_code}}

This code expires in 15 minutes.

- UDAAN Team
```

4. Save and note down the **Template ID** (e.g., `template_xxxxxxx`)

---

## Step 4: Get Your Public Key

1. Go to **Account** (top right)
2. Click on **General** tab
3. Find and copy your **Public Key**

---

## Step 5: Configure Environment Variables

Create or update your `.env` file in the project root:

```env
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
```

Replace the placeholder values with your actual EmailJS credentials.

---

## Step 6: Test the Setup

1. Start the development server: `npm run dev`
2. Go to **Settings** in the Member Portal
3. Add/change your personal email
4. Request a verification code
5. Check your inbox for the email

---

## 📧 Email Template

The email is sent using the template configured in EmailJS. The code uses these variables:

| Variable | Description |
|----------|-------------|
| `to_email` | Recipient's email address |
| `to_name` | Recipient's name |
| `verification_code` | 6-digit verification code |

---

## 🔧 Troubleshooting

### Email not sending

1. **Check console for errors** - Open browser DevTools (F12) and look for EmailJS errors
2. **Verify credentials** - Ensure all 3 environment variables are set correctly
3. **Check quota** - Free tier has 200 emails/month limit

### "Invalid service ID" error

- Double-check the Service ID in your EmailJS dashboard
- Make sure the service is connected and active

### "Invalid template ID" error

- Verify the Template ID matches your created template
- Ensure the template is not in draft mode

### Emails going to spam

1. Use a professional email service (not personal Gmail)
2. Add proper sender information in EmailJS template settings
3. Avoid spam trigger words in subject/content

---

## 📊 Monitoring

### EmailJS Dashboard
View email logs and quota usage:
- https://dashboard.emailjs.com

You can see:
- Sent emails history
- Remaining quota
- Error logs

---

## 📁 File Structure

```
utils/
  email.ts           # EmailJS client wrapper

.env                 # Environment variables (not committed to git)
  VITE_EMAILJS_SERVICE_ID
  VITE_EMAILJS_TEMPLATE_ID
  VITE_EMAILJS_PUBLIC_KEY
```

---

## ⚠️ Security Notes

1. **Public Key Exposure**: EmailJS public key is visible in client-side code (this is expected and safe)
2. **Rate Limiting**: EmailJS has built-in protection against abuse
3. **Free Tier Limits**: 200 emails/month - upgrade if needed

---

## 🔄 Upgrading Quota

If you exceed 200 emails/month:
1. Go to **https://www.emailjs.com/pricing**
2. Choose a paid plan (starts at $9/month for 1,000 emails)
3. Or consider migrating to a server-side solution like Brevo for higher volumes
