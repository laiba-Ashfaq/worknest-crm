import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'worknest_super_secret_jwt_key_default',
  sessionExpiry: process.env.SESSION_EXPIRY || '7d',
  
  // Demonstration timing mode
  demoMode: process.env.DEMO_MODE === 'true',
  defaultDemoTimerSeconds: parseInt(process.env.DEFAULT_DEMO_TIMER_SECONDS || '30', 10),
  
  // Meta WhatsApp Cloud API
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  },

  // Safepay Sandbox API (Pakistan)
  safepay: {
    apiKey: process.env.SAFEPAY_API_KEY || '',
    secretKey: process.env.SAFEPAY_SECRET_KEY || '',
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET || '',
    sandboxUrl: process.env.SAFEPAY_SANDBOX_URL || 'https://sandbox.api.getsafepay.com',
  },

  // Google Calendar OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/integrations/google-calendar/callback',
  },

  // SMTP Email Notification
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'WorkNest Alerts <alerts@worknest.app>',
  },
};
