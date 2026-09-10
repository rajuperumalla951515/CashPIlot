import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://spxxihlteuicflicrhqk.supabase.co";

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_uxAdDyh9yc2qLEka0qLK8Q_9SC4nD5O";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);


