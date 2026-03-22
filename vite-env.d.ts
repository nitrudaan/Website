/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_EMAIL_API_URL: string;
  readonly VITE_EMAIL_API_URL_BACKUP: string;
  readonly VITE_EMAIL_API_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
