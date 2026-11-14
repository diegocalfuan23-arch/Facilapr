"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  crearSocio,
  editarSocio,
  type ResultadoAccion,
} from "@/app/panel/socios/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SocioEditable = {
  id: string;
  nombre: string;
  rut: string | null;
  tipo: "SOCIO" | "USUARIO";
  uso: "RESIDENCIAL" | "COMERCIAL";
  telefono: string | null;
  direccion: string | null;
  numeroCliente: string | null;
  /** Aceptó recibir WhatsApp automáticos de su comité. */
  whatsappConsentimiento: boolean;
};

/** El siguiente N.º de arranque libre para cada tipo: el mayor que ya hay, más uno (1 si no hay ninguno con número). */
export function siguientesNumeros(socios: { tipo: "SOCIO" | "USUARIO"; numeroCliente: string | null }[]): Record<"SOCIO" | "USUARIO", string> {
  const siguiente = (tipo: "SOCIO" | "USUARIO") => {
    const numeros = socios.filter((s) => s.tipo === tipo && s.numeroCliente && /^\d+$/.test(s.numeroCliente.trim())).map((s) => Number(s.numeroCliente));
    return String((numeros.length ? Math.max(...numeros) : 0) + 1);
  };
  return { SOCIO: siguiente("SOCIO"), USUARIO: siguiente("USUARIO") };
}

export function SocioDialog({
  abierto,
  onAbiertoChange,
  socio,
  siguientes,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  socio?: SocioEditable;
  /** Solo al crear: el N.º que se sugiere para cada tipo. Se puede cambiar o borrar. */
  siguientes?: Record<"SOCIO" | "USUARIO", string>;
}) {
  const editando = Boolean(socio);
  // Al crear, el N.º de arranque parte con el siguiente libre de su tipo; si la persona lo toca, deja de cambiar solo.
  const [tipo, setTipo] = useState<"SOCIO" | "USUARIO">(socio?.tipo ?? "SOCIO");
  const [numero, setNumero] = useState(socio ? (socio.numeroCliente ?? "") : (siguientes?.SOCIO ?? ""));
  const [numeroTocado, setNumeroTocado] = useState(false);
  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(editando ? editarSocio : crearSocio, null);

  useEffect(() => {
    if (estado?.ok) onAbiertoChange(false);
  }, [estado, onAbiertoChange]);

  // Después de un error el formulario se vacía solo; se vuelve a armar con lo que la persona había escrito.
  const v = estado && !estado.ok ? estado.valores : undefined;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar socio" : "Nuevo socio"}</DialogTitle>
          <DialogDescription>
            Con teléfono, el socio puede recibir su boleta por WhatsApp. Si
            todavía no lo tienes, déjalo vacío y agrégalo después.
          </DialogDescription>
        </DialogHeader>

        <form key={estado && !estado.ok ? (estado.intento ?? 0) : "base"} action={accion} className="flex flex-col gap-4">
          {socio && <input type="hidden" name="socioId" value={socio.id} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={v?.nombre ?? socio?.nombre}
              placeholder="María Huenchuñir"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rut">RUT (opcional)</Label>
              <Input
                id="rut"
                name="rut"
                defaultValue={v?.rut ?? socio?.rut ?? ""}
                placeholder="12.345.678-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                name="telefono"
                defaultValue={v?.telefono ?? socio?.telefono ?? ""}
                placeholder="9 1234 5678"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="whatsappConsentimiento"
              defaultChecked={v ? v.whatsappConsentimiento === "on" : (socio?.whatsappConsentimiento ?? false)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="text-[0.88rem]">
              <span className="font-medium">Acepta recibir WhatsApp automáticos</span>
              <span className="block text-[0.8rem] text-muted-foreground">
                Boletas, comprobantes y avisos. Márcalo solo si el socio te lo dijo.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => {
                const nuevo = e.target.value === "USUARIO" ? "USUARIO" : "SOCIO";
                setTipo(nuevo);
                // Socios y usuarios llevan numeración aparte: si el N.º es el sugerido, pasa al siguiente del otro tipo.
                if (!editando && !numeroTocado && siguientes) setNumero(siguientes[nuevo]);
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="SOCIO">Socio</option>
              <option value="USUARIO">Usuario (no es socio, pero paga)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="uso">Uso del agua</Label>
            <select
              id="uso"
              name="uso"
              defaultValue={v?.uso ?? socio?.uso ?? "RESIDENCIAL"}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="RESIDENCIAL">Residencial</option>
              <option value="COMERCIAL">Comercial</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numeroCliente">N.º de arranque</Label>
              <Input
                id="numeroCliente"
                name="numeroCliente"
                value={numero}
                onChange={(e) => {
                  setNumero(e.target.value);
                  setNumeroTocado(true);
                }}
                placeholder="Opcional"
                inputMode="numeric"
              />
              {!editando && siguientes ? (
                <p className="text-[0.78rem] text-muted-foreground">
                  Sugerido: el {siguientes[tipo]}, el siguiente libre. Cámbialo si quieres otro, o bórralo para dejarlo sin número.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                defaultValue={v?.direccion ?? socio?.direccion ?? ""}
                placeholder="Opcional"
              />
            </div>
          </div>

          {estado && !estado.ok && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive"
            >
              {estado.error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAbiertoChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              {pendiente
                ? "Guardando…"
                : editando
                  ? "Guardar cambios"
                  : "Guardar socio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
