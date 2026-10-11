"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** `compacto`: solo el ícono, para el encabezado de la app del técnico. */
export function SignOutButton({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size={compacto ? "icon-lg" : "default"}
      aria-label="Cerrar sesión"
      onClick={async () => {
        await signOut();
        // Borra la copia de la pantalla de lecturas que guarda el service
        // worker: en un teléfono compartido no debe sobrevivir a la sesión.
        try {
          await caches.delete("facilapr-terreno-v1");
        } catch {
          // Sin Cache API no hay nada que borrar.
        }
        router.push("/login");
      }}
    >
      {compacto ? (
        <LogOut />
      ) : (
        <>
          {/* En el celular solo el ícono: el texto no cabía junto al nombre del comité. */}
          <LogOut className="sm:hidden" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </>
      )}
    </Button>
  );
}
