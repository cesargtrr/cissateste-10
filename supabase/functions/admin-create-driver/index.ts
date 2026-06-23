import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!service) {
      return json(
        { error: "Service role key is not configured for driver creation", code: "service_role_missing" },
        500
      );
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, service);

    // Verify admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const {
      name, phone, tipo_veiculo, placa, observacoes, active,
      email, password,
    } = body || {};

    if (!name || !email || !password) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (String(password).length < 6) {
      return json({ error: "Password too short", code: "password_too_short" }, 400);
    }

    // Resolve restaurant_id from the restaurants table (single-tenant).
    // The client previously sent restaurant_settings.id which violates the FK
    // delivery_drivers.restaurant_id -> restaurants.id.
    const { data: restaurantRow, error: restErr } = await admin
      .from("restaurants")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (restErr || !restaurantRow?.id) {
      return json({ error: "No restaurant configured" }, 400);
    }
    const restaurant_id = restaurantRow.id as string;

    // Create auth user — if it already exists, attempt to recover/link instead of erroring.
    const normalizedEmail = String(email).trim().toLowerCase();
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message || "Failed to create user";
      const isDuplicate = /already|exist|registered|duplicate/i.test(msg);
      const isPasswordTooShort = /password.*short|password.*at least|weak_password/i.test(msg);

      if (!isDuplicate) {
        return json(
          {
            error: msg,
            code: isPasswordTooShort ? "password_too_short" : "create_user_failed",
          },
          400
        );
      }

      // Duplicate email — find the existing auth user and check if a driver row already exists.
      let existingUserId: string | null = null;
      for (let page = 1; page <= 20 && !existingUserId; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) break;
        const match = list?.users?.find((u) => (u.email || "").toLowerCase() === normalizedEmail);
        if (match) existingUserId = match.id;
        if (!list?.users?.length || list.users.length < 200) break;
      }

      if (!existingUserId) {
        return json({ error: msg, code: "email_exists" }, 409);
      }

      const { data: existingDriver } = await admin
        .from("delivery_drivers")
        .select("id, restaurant_id")
        .eq("user_id", existingUserId)
        .maybeSingle();

      if (existingDriver) {
        return json(
          {
            error: "Este e-mail já está cadastrado como entregador.",
            code: "driver_already_exists",
            driver_id: existingDriver.id,
          },
          409
        );
      }

      // Orphan auth user — link by creating the missing driver row below.
      userId = existingUserId;
    } else {
      userId = created.user.id;
    }

    // Insert into delivery_drivers
    const { data: driver, error: driverErr } = await admin
      .from("delivery_drivers")
      .insert({
        restaurant_id,
        name,
        phone: phone || null,
        tipo_veiculo: tipo_veiculo || null,
        placa: placa || null,
        observacoes: observacoes || null,
        active: active ?? true,
        user_id: userId,
      })
      .select()
      .single();

    if (driverErr) {
      // rollback auth user only if we just created it in this request
      if (created?.user) {
        await admin.auth.admin.deleteUser(userId!).catch(() => {});
      }
      return json({ error: driverErr.message }, 400);
    }

    // Mirror in delivery_driver_users for portal compatibility
    await admin.from("delivery_driver_users").insert({
      restaurant_id,
      driver_id: driver.id,
      user_id: userId,
      email: String(email).trim().toLowerCase(),
      active: active ?? true,
    }).catch(() => {});

    return json({ driver_id: driver.id, user_id: userId });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}