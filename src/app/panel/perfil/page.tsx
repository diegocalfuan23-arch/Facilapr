import type { Metadata } from "next";
import { requireApr } from "@/lib/apr-session";
import { PerfilForm } from "@/components/panel/perfil-form";

export const metadata: Metadata = {
  title: "Mi perfil",
};

/** El perfil de quien tiene la sesión abierta: distinto de los datos del comité. Se llega desde el menú del comité. */
export default async function PerfilPage() {
  const { user } = await requireApr();

  return (
    <>
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Mi perfil</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Tus datos personales y tu contraseña.
        </p>
      </div>
      <PerfilForm
        nombre={user.name}
        correo={user.email}
        cargo={user.cargo}
        esAdmin={user.rol === "ADMIN"}
      />
    </>
  );
}
