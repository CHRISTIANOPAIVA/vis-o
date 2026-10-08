import { z } from "zod";
import db from "@/lib/db";
import { errorResponse, dbErrorResponse } from "@/lib/api";
import { computeTargets } from "@/lib/nutrition";
import type { UserProfile } from "@/types";

const DEFAULT_PROFILE: UserProfile = {
  weight_kg: 70,
  height_cm: 170,
  age: 25,
  sex: "male",
  goal: "maintain",
};

const ProfileSchema = z.object({
  weight_kg: z.number().positive(),
  height_cm: z.number().positive(),
  age: z.number().int().min(1).max(120),
  sex: z.enum(["male", "female"]),
  goal: z.enum(["lose_weight", "maintain", "gain_muscle"]),
});

export async function GET() {
  // maybeSingle: tabela sem linha ainda (perfil nunca salvo) nao e erro e cai
  // no padrao; erro de verdade do banco tem que aparecer, nao virar perfil falso.
  const { data, error } = await db
    .from("user_profile")
    .select("weight_kg, height_cm, age, sex, goal")
    .eq("id", 1)
    .maybeSingle();

  if (error) return dbErrorResponse("Erro ao buscar perfil", error);

  const profile = (data as UserProfile | null) ?? DEFAULT_PROFILE;
  return Response.json(computeTargets(profile));
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON invalido.");
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Dados do perfil invalidos.");
  }

  const { weight_kg, height_cm, age, sex, goal } = parsed.data;
  const { error } = await db
    .from("user_profile")
    .upsert({ id: 1, weight_kg, height_cm, age, sex, goal, updated_at: new Date().toISOString() });

  if (error) return dbErrorResponse("Erro ao salvar perfil", error);
  return Response.json(computeTargets(parsed.data));
}
