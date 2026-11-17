import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nzrvoybnfxhmzhhulmvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56cnZveWJuZnhobXpoaHVsbXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5MDU2MjYsImV4cCI6MjExMDQ4MTYyNn0.Gcr0li3rV3zNyMf_KG3pkAmWJ_f6URm_Bt0-ok7vl70';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
