import { z } from "zod";
import db from "@/lib/db";
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
  const row = db.prepare("SELECT * FROM user_profile WHERE id = 1").get() as UserProfile | undefined;
  const profile = row ?? DEFAULT_PROFILE;
  return Response.json(computeTargets(profile));
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
  }

  const { weight_kg, height_cm, age, sex, goal } = parsed.data;
  db.prepare(
    `INSERT OR REPLACE INTO user_profile (id, weight_kg, height_cm, age, sex, goal)
     VALUES (1, ?, ?, ?, ?, ?)`
  ).run(weight_kg, height_cm, age, sex, goal);

  return Response.json(computeTargets(parsed.data));
}
