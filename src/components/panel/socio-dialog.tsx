"use client";

import { useActionState, useEffect } from "react";
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

export function SocioDialog({
  abierto,
  onAbiertoChange,
  socio,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  socio?: SocioEditable;
}) {
  const editando = Boolean(socio);
  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(editando ? editarSocio : crearSocio, null);

  useEffect(() => {
    if (estado?.ok) onAbiertoChange(false);
  }, [estado, onAbiertoChange]);

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

        <form action={accion} className="flex flex-col gap-4">
          {socio && <input type="hidden" name="socioId" value={socio.id} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={socio?.nombre}
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
                defaultValue={socio?.rut ?? ""}
                placeholder="12.345.678-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                name="telefono"
                defaultValue={socio?.telefono ?? ""}
                placeholder="9 1234 5678"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="whatsappConsentimiento"
              defaultChecked={socio?.whatsappConsentimiento ?? false}
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
              defaultValue={socio?.tipo ?? "SOCIO"}
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
              defaultValue={socio?.uso ?? "RESIDENCIAL"}
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
                defaultValue={socio?.numeroCliente ?? ""}
                placeholder="Opcional"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                defaultValue={socio?.direccion ?? ""}
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
