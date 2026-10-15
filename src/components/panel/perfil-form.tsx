"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cambiarClave, guardarPerfil } from "@/app/panel/perfil/actions";
import { CampoClave } from "@/components/auth/campo-clave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARGOS } from "@/lib/cargos";

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <h2 className="text-[1.05rem] font-semibold">{titulo}</h2>
      <p className="mt-0.5 text-[0.88rem] text-muted-foreground">{descripcion}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Los datos de quien tiene la sesión abierta: no son los del comité, que están en Configuración. */
export function PerfilForm({
  nombre,
  correo,
  cargo,
  esAdmin,
}: {
  nombre: string;
  correo: string;
  cargo: string;
  esAdmin: boolean;
}) {
  const [cargoElegido, setCargoElegido] = useState(CARGOS.some((c) => c.value === cargo) ? cargo : "");
  const [guardando, setGuardando] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  async function enviarPerfil(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorPerfil(null);
    setGuardando(true);
    const datos = new FormData(e.currentTarget);
    const r = await guardarPerfil({ nombre: String(datos.get("nombre") ?? ""), cargo: cargoElegido });
    setGuardando(false);
    if (r.ok) toast.success("Perfil guardado");
    else setErrorPerfil(r.error);
  }

  async function enviarClave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorClave(null);
    setCambiando(true);
    const formulario = e.currentTarget;
    const datos = new FormData(formulario);
    const r = await cambiarClave({
      actual: String(datos.get("actual") ?? ""),
      nueva: String(datos.get("nueva") ?? ""),
      repetida: String(datos.get("repetida") ?? ""),
    });
    setCambiando(false);
    if (r.ok) {
      formulario.reset();
      toast.success("Contraseña cambiada. Las otras sesiones abiertas se cerraron.");
    } else {
      setErrorClave(r.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Seccion
        titulo="Tus datos"
        descripcion="Es tu perfil personal, el de quien entra a este panel. Los datos del comité están en Configuración."
      >
        <form onSubmit={enviarPerfil} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Tu nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={nombre}
              autoComplete="name"
              maxLength={80}
              className="h-10"
              required
            />
          </div>

          {esAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cargo">Tu cargo en el comité</Label>
              <Select items={CARGOS} value={cargoElegido} onValueChange={(v) => setCargoElegido(v ?? "")}>
                <SelectTrigger id="cargo" className="w-full">
                  <SelectValue placeholder="Selecciona un cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correo">Correo de ingreso</Label>
            <Input id="correo" value={correo} readOnly disabled className="h-10" />
            <span className="text-[0.8rem] text-muted-foreground">
              Es el correo con el que entras. Si necesitas cambiarlo, escríbenos a hola@facilapr.cl.
            </span>
          </div>

          {errorPerfil && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive">
              {errorPerfil}
            </p>
          )}

          <Button type="submit" disabled={guardando} className="self-start">
            {guardando && <Loader2 className="animate-spin" />}
            Guardar cambios
          </Button>
        </form>
      </Seccion>

      <Seccion
        titulo="Contraseña"
        descripcion="Pide tu contraseña actual para cambiarla. Al cambiarla, se cierran tus otras sesiones abiertas."
      >
        <form onSubmit={enviarClave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="actual">Contraseña actual</Label>
            <Input
              id="actual"
              name="actual"
              type="password"
              autoComplete="current-password"
              className="h-10"
              required
            />
          </div>

          <CampoClave id="nueva" name="nueva" label="Contraseña nueva" confirmarId="repetida" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repetida">Repite la contraseña nueva</Label>
            <Input
              id="repetida"
              name="repetida"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="h-10"
              required
            />
          </div>

          {errorClave && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive">
              {errorClave}
            </p>
          )}

          <Button type="submit" disabled={cambiando} className="self-start">
            {cambiando && <Loader2 className="animate-spin" />}
            Cambiar contraseña
          </Button>
        </form>
      </Seccion>
    </div>
  );
}
