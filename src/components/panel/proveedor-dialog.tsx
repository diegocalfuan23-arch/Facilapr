"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { guardarProveedor, type ResultadoCompras } from "@/app/panel/compras/actions";
import { avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONDICIONES_PAGO, type ProveedorFila } from "@/lib/compras-comun";
import { rutValido } from "@/lib/formato";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const campo = "h-10 rounded-lg border-[#E4E1F0] shadow-none";
const etiqueta = "flex flex-col gap-1.5 text-[13px] font-medium";

/** Deja el RUT con puntos y guion a medida que se escribe: 76123456K → 76.123.456-K. */
function formatoRut(v: string) {
  const r = v.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (r.length < 2) return r;
  return `${r.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${r.slice(-1)}`;
}

/** Crear un proveedor, o corregir uno que ya existe. Se borra desde la tabla, y solo si no tiene compras. */
export function ProveedorDialog({ proveedor, onCerrar }: { proveedor: ProveedorFila | null; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoCompras | null, FormData>(guardarProveedor, null);
  const editando = proveedor !== null;
  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [rut, setRut] = useState(proveedor?.rut ?? "");
  const [dias, setDias] = useState(String(proveedor?.diasPago ?? 0));

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Proveedor actualizado" : "Proveedor registrado");
      avisarCambio("compras");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  // Un RUT escrito tiene que calzar con su dígito verificador; sin RUT también se puede guardar.
  const largoRut = rut.replace(/[^0-9K]/gi, "").length;
  const rutMalo = largoRut > 0 && !rutValido(rut);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-[520px] overflow-y-auto rounded-2xl p-0 sm:max-w-[520px]">
        <div className="border-b border-[#F0EEF6] px-6 py-5">
          <DialogTitle className="text-lg font-semibold">{editando ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription className={cn("mt-0.5 text-[13px]", GRIS)}>El RUT es necesario para registrar sus facturas.</DialogDescription>
        </div>

        <form action={enviar} className="flex flex-col gap-4 px-6 py-5">
          {editando && <input type="hidden" name="id" value={proveedor.id} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <label className={etiqueta}>
              Nombre o razón social
              <Input name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Ferretería El Roble" maxLength={120} className={campo} autoFocus required />
            </label>
            <label className={etiqueta}>
              RUT
              <Input name="rut" value={rut} onChange={(e) => setRut(formatoRut(e.target.value))} placeholder="76.123.456-7" inputMode="text" maxLength={12} className={cn(campo, "tabular-nums", rutMalo && "border-[#F2C1C0]")} />
              {rutMalo && <span className="text-xs font-normal text-[#A32020]">{largoRut < 8 ? "RUT incompleto" : "RUT no válido"}</span>}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={etiqueta}>
              Rubro
              <Input name="rubro" defaultValue={proveedor?.rubro ?? ""} placeholder="Ej.: Ferretería, químicos" maxLength={80} className={campo} />
            </label>
            <label className={etiqueta}>
              Condición de pago
              <input type="hidden" name="diasPago" value={dias} />
              <Select value={dias} onValueChange={(v) => setDias(v as string)}>
                <SelectTrigger className="h-10 w-full rounded-lg border-[#E4E1F0] px-3">
                  <SelectValue>{(v) => CONDICIONES_PAGO.find((c) => String(c.dias) === v)?.texto ?? "Contado"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CONDICIONES_PAGO.map((c) => (
                    <SelectItem key={c.dias} value={String(c.dias)}>
                      {c.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <p className={cn("-mb-1 text-xs font-semibold tracking-wide uppercase", GRIS)}>Contacto</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={etiqueta}>
              Nombre
              <Input name="contacto" defaultValue={proveedor?.contacto ?? ""} placeholder="Ej.: Juan Pérez" maxLength={120} className={campo} />
            </label>
            <label className={etiqueta}>
              Teléfono
              <Input name="telefono" defaultValue={proveedor?.telefono ?? ""} placeholder="+56 9 1234 5678" inputMode="tel" maxLength={30} className={campo} />
            </label>
          </div>
          <label className={etiqueta}>
            Correo
            <Input name="email" type="email" defaultValue={proveedor?.email ?? ""} placeholder="ventas@proveedor.cl" maxLength={120} className={campo} />
          </label>
          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2 border-t border-[#F0EEF6] pt-4">
            <Button type="button" variant="ghost" onClick={onCerrar} className="h-10 rounded-lg px-4 font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente || !nombre.trim() || rutMalo} className="h-10 rounded-lg px-5 font-semibold">
              {pendiente && <Loader2 className="animate-spin" />}
              {editando ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
