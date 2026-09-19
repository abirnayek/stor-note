import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adxlfoqoypkwnyrunirb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeGxmb3FveXBrd255cnVuaXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NzA5MDcsImV4cCI6MjEwNTE0NjkwN30.-QM5Cg7GQwzGb5mOn8o6d7H7Qx7R3XxabgxtWAq4T5Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
