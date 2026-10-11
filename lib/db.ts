import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

// Validado na importacao: se faltar variavel, falha cedo e com mensagem clara.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
export default db;
