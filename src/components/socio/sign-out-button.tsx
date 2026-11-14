"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutSocioButton({ base, variante = "texto" }: { base: string; variante?: "texto" | "icono" }) {
  const router = useRouter();

  async function salir() {
    await signOut();
    router.push(`${base}/entrar`);
  }

  if (variante === "icono") {
    return (
      <Button variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={salir} className="size-9 shrink-0 rounded-lg text-[#5B5970]">
        <LogOut className="size-4" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={salir}>
      Cerrar sesión
    </Button>
  );
}
