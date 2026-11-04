"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Baja una tabla como planilla con punto y coma, la que abre bien el Excel en español. */
export function DescargarCsvBoton({ nombreArchivo, filas }: { nombreArchivo: string; filas: (string | number)[][] }) {
  function descargar() {
    const celda = (t: string | number) => `"${String(t).replace(/"/g, '""')}"`;
    const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" className="h-10 rounded-xl px-4 text-[0.95rem]" onClick={descargar}>
      <Download />
      Descargar
    </Button>
  );
}
