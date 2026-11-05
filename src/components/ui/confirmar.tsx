"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type OpcionesConfirmar = {
  titulo: string;
  descripcion?: string;
  /** Lo que dice el botón que confirma. */
  boton?: string;
  /** Un botón rojo, para lo que borra o no se puede deshacer. Por defecto sí. */
  destructivo?: boolean;
};

/**
 * Reemplazo del `window.confirm` del navegador por un modal propio, con el estilo del panel.
 *
 * Se usa así: `const { confirmar, dialogo } = useConfirmar();`, se pone `{dialogo}` en el JSX y se
 * pregunta con `if (!(await confirmar({ titulo: "¿Borrar?" }))) return;`.
 *
 * `{dialogo}` va dentro del mismo componente (y, si ese está dentro de un modal, dentro de él): así el
 * modal de abajo no se cierra cuando se hace clic en el de confirmación.
 */
export function useConfirmar() {
  const [pendiente, setPendiente] = useState<{ opciones: OpcionesConfirmar; resolver: (r: boolean) => void } | null>(null);

  const confirmar = useCallback(
    (opciones: OpcionesConfirmar) =>
      new Promise<boolean>((resolver) => {
        setPendiente({ opciones, resolver });
      }),
    []
  );

  function responder(r: boolean) {
    pendiente?.resolver(r);
    setPendiente(null);
  }

  const dialogo = pendiente ? (
    <Dialog open onOpenChange={(abierto) => !abierto && responder(false)}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{pendiente.opciones.titulo}</DialogTitle>
          {pendiente.opciones.descripcion && <DialogDescription className="text-[0.9rem]">{pendiente.opciones.descripcion}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" autoFocus onClick={() => responder(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={pendiente.opciones.destructivo === false ? "default" : "destructive"}
            className="h-10 px-4 text-[0.95rem]"
            onClick={() => responder(true)}
          >
            {pendiente.opciones.boton ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirmar, dialogo };
}
