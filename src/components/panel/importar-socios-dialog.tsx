"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import {
  importarSociosRevisados,
  previsualizarSocios,
  type Previsualizacion,
} from "@/app/panel/socios/importar-actions";
import { validarFilas, type FilaSocio, type Veredicto } from "@/lib/importar-socios";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

type Vista = Extract<Previsualizacion, { ok: true }>;
type FilaEditable = FilaSocio & { incluida: boolean };

const ACEPTA =
  ".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Importar socios en dos pasos: 1) se sube el archivo (CSV, Excel o PDF) y el
 * sistema detecta las filas; 2) la directiva REVISA lo detectado, corrige o
 * excluye lo dudoso, y recién ahí se carga. Nada se guarda antes de confirmar.
 */
export function ImportarSociosDialog({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista | null>(null);
  const [resultado, setResultado] = useState<{
    creados: number;
    actualizados: number;
    desactivados: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, iniciarLectura] = useTransition();

  function cambiarAbierto(v: boolean) {
    onAbiertoChange(v);
    if (!v) {
      // Se limpia al cerrar, para que la próxima vez parta desde el archivo.
      setVista(null);
      setResultado(null);
      setError(null);
    }
  }

  function leer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setError(null);
    iniciarLectura(async () => {
      const r = await previsualizarSocios(datos);
      if (r.ok) setVista(r);
      else setError(r.error);
    });
  }

  const ancho = vista && !resultado ? "sm:max-w-6xl" : "sm:max-w-130";

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className={ancho}>
        <DialogHeader>
          <DialogTitle>Importar socios</DialogTitle>
          <DialogDescription>
            {resultado
              ? "Listo."
              : vista
                ? "Revisa lo que encontré antes de cargarlo. Puedes corregir cualquier dato o dejar filas fuera."
                : "Sube el padrón en Excel, CSV o PDF. Detecto solo dónde están los datos y te lo muestro para que lo revises."}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-forest/30 bg-forest/5 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" />
              <p className="text-[0.92rem]">
                <strong>{resultado.creados}</strong>{" "}
                {resultado.creados === 1 ? "cuenta creada" : "cuentas creadas"} y{" "}
                <strong>{resultado.actualizados}</strong>{" "}
                {resultado.actualizados === 1 ? "actualizada" : "actualizadas"}
                {resultado.desactivados > 0 && (
                  <>
                    {" "}
                    y <strong>{resultado.desactivados}</strong>{" "}
                    {resultado.desactivados === 1 ? "desactivada" : "desactivadas"} por no
                    venir en la lista
                  </>
                )}
                .
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => cambiarAbierto(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : vista ? (
          <Revision
            vista={vista}
            onVolver={() => setVista(null)}
            onListo={(r) => {
              setResultado(r);
              router.refresh();
            }}
          />
        ) : (
          <form onSubmit={leer} className="flex flex-col gap-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-[0.85rem]">
              <p className="font-medium">Qué puedo leer</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  <strong>Excel o CSV:</strong> con títulos arriba, y con socios
                  y usuarios en tablas separadas, no importa. Busco la fila de
                  encabezados («Nombre», «RUT»…).
                </li>
                <li>
                  <strong>PDF:</strong> solo si tiene texto (uno exportado desde
                  Excel). Un PDF escaneado o una foto no se puede leer.
                </li>
                <li>
                  Cada fila es un <strong>arranque</strong>: una persona con dos
                  medidores son dos filas. El teléfono y el RUT son opcionales.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="archivoSocios">Archivo</Label>
              <Input
                id="archivoSocios"
                name="archivo"
                type="file"
                accept={ACEPTA}
                required
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-[0.88rem] text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => cambiarAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={leyendo}>
                {leyendo ? <Loader2 className="animate-spin" /> : <FileUp />}
                {leyendo ? "Leyendo…" : "Leer y revisar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Revision({
  vista,
  onVolver,
  onListo,
}: {
  vista: Vista;
  onVolver: () => void;
  onListo: (r: { creados: number; actualizados: number; desactivados: number }) => void;
}) {
  const [filas, setFilas] = useState<FilaEditable[]>(() => {
    // Lo que no tiene errores entra marcado; lo con errores, fuera hasta corregirlo.
    const inicial = validarFilas(vista.filas, vista.existentes);
    return vista.filas.map((f, i) => ({
      ...f,
      incluida: inicial[i].errores.length === 0,
    }));
  });
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [desactivarAusentes, setDesactivarAusentes] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  function cambiar(id: string, cambios: Partial<FilaEditable>) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  // Cada fila se valida en el contexto de las incluidas: así, dejar una fuera
  // resuelve su repetida, y volver a incluirla muestra el choque al instante.
  const veredictos = useMemo(() => {
    const incluidas = filas.filter((f) => f.incluida);
    const base = validarFilas(incluidas, vista.existentes);
    const mapa = new Map<string, Veredicto>();
    incluidas.forEach((f, i) => mapa.set(f.id, base[i]));
    for (const f of filas) {
      if (f.incluida) continue;
      const v = validarFilas([...incluidas, f], vista.existentes);
      mapa.set(f.id, v[v.length - 1]);
    }
    return mapa;
  }, [filas, vista.existentes]);

  const incluidas = filas.filter((f) => f.incluida);
  const conError = incluidas.filter((f) => (veredictos.get(f.id)?.errores.length ?? 0) > 0);
  const aCrear = incluidas.filter((f) => veredictos.get(f.id)?.accion === "crear").length;
  const aActualizar = incluidas.length - aCrear;
  const excluidas = filas.length - incluidas.length;
  const socios = incluidas.filter((f) => f.tipo === "SOCIO").length;
  const usuarios = incluidas.length - socios;

  // Cuentas activas del sistema que no están entre las filas a cargar.
  const tocados = new Set(
    incluidas.flatMap((f) => {
      const id = veredictos.get(f.id)?.existenteId;
      return id ? [id] : [];
    })
  );
  const ausentes = vista.existentes.filter((e) => e.activo && !tocados.has(e.id));

  const visibles = soloProblemas
    ? filas.filter(
        (f) => !f.incluida || (veredictos.get(f.id)?.errores.length ?? 0) > 0
      )
    : filas;

  function confirmar() {
    setErrorEnvio(null);
    iniciarEnvio(async () => {
      const r = await importarSociosRevisados(
        incluidas.map((f) => ({
          id: f.id,
          linea: f.linea,
          tipo: f.tipo,
          nombre: f.nombre,
          rut: f.rut,
          telefono: f.telefono,
          direccion: f.direccion,
          numeroCliente: f.numeroCliente,
          uso: f.uso,
        })),
        { desactivarAusentes }
      );
      if (r.ok) onListo(r);
      else setErrorEnvio(r.error);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ul className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-[0.82rem] text-muted-foreground">
        {vista.notas.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.88rem]">
          <strong className="tabular-nums">{incluidas.length}</strong> por
          cargar ({socios} socios, {usuarios} usuarios) ·{" "}
          <span className="tabular-nums">{aCrear}</span> nuevas ·{" "}
          <span className="tabular-nums">{aActualizar}</span> ya existen ·{" "}
          <span className="tabular-nums">{excluidas}</span> fuera
          {conError.length > 0 && (
            <span className="ml-2 font-medium text-destructive">
              {conError.length} con error
            </span>
          )}
        </p>
        <label className="flex items-center gap-2 text-[0.85rem]">
          <Checkbox
            checked={soloProblemas}
            onCheckedChange={(v) => setSoloProblemas(Boolean(v))}
          />
          Solo errores y filas fuera
        </label>
      </div>

      <div className="max-h-[48vh] overflow-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[820px] text-[0.85rem]">
          <thead className="sticky top-0 z-10 bg-muted text-left text-[0.78rem] text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-2 py-2 font-medium">Fila</th>
              <th className="px-2 py-2 font-medium">Tipo</th>
              <th className="px-2 py-2 font-medium">N.º</th>
              <th className="px-2 py-2 font-medium">Nombre</th>
              <th className="px-2 py-2 font-medium">RUT</th>
              <th className="px-2 py-2 font-medium">Teléfono</th>
              <th className="px-2 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {visibles.map((f) => {
              const v = veredictos.get(f.id);
              const hayError = (v?.errores.length ?? 0) > 0;
              return (
                <tr
                  key={f.id}
                  className={cn(
                    !f.incluida && "bg-muted/40 text-muted-foreground",
                    f.incluida && hayError && "bg-destructive/5"
                  )}
                >
                  <td className="px-3 py-1.5">
                    <Checkbox
                      checked={f.incluida}
                      aria-label={`Incluir la fila ${f.linea}`}
                      onCheckedChange={(c) => cambiar(f.id, { incluida: Boolean(c) })}
                    />
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {f.linea}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={f.tipo}
                      onChange={(e) =>
                        cambiar(f.id, {
                          tipo: e.target.value === "USUARIO" ? "USUARIO" : "SOCIO",
                        })
                      }
                      className="h-8 rounded-md border border-input bg-transparent px-1.5 text-[0.82rem]"
                    >
                      <option value="SOCIO">Socio</option>
                      <option value="USUARIO">Usuario</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={f.numeroCliente}
                      onChange={(e) => cambiar(f.id, { numeroCliente: e.target.value })}
                      className="h-8 w-16 px-2 text-[0.82rem]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={f.nombre}
                      onChange={(e) => cambiar(f.id, { nombre: e.target.value })}
                      className="h-8 min-w-48 px-2 text-[0.82rem]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={f.rut}
                      onChange={(e) => cambiar(f.id, { rut: e.target.value })}
                      placeholder="—"
                      className="h-8 w-32 px-2 text-[0.82rem]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={f.telefono}
                      onChange={(e) => cambiar(f.id, { telefono: e.target.value })}
                      placeholder="—"
                      className="h-8 w-32 px-2 text-[0.82rem]"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {!f.incluida && (
                      <span className="text-[0.78rem]">Fuera de la carga</span>
                    )}
                    {v?.errores.map((m) => (
                      <div key={m} className="text-[0.78rem] font-medium text-destructive">
                        {m}
                      </div>
                    ))}
                    {f.incluida &&
                      v?.avisos.map((m) => (
                        <div key={m} className="text-[0.78rem] text-tertiary-texto">
                          {m}
                        </div>
                      ))}
                    {f.incluida && v && v.errores.length === 0 && v.avisos.length === 0 && (
                      <span className="text-[0.78rem] text-forest">Nueva</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ausentes.length > 0 && (
        <label className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-[0.88rem]">
          <Checkbox
            checked={desactivarAusentes}
            onCheckedChange={(v) => setDesactivarAusentes(Boolean(v))}
            className="mt-0.5"
          />
          <span>
            Desactivar los <strong className="tabular-nums">{ausentes.length}</strong> que están
            en el sistema pero no en esta lista
            <span className="mt-0.5 block text-[0.8rem] text-muted-foreground">
              Por ejemplo fallecidos o sin servicio. No se borran: conservan su historial y se
              pueden reactivar. {ausentes.slice(0, 4).map((e) => e.nombre).join(", ")}
              {ausentes.length > 4 && "…"}
            </span>
          </span>
        </label>
      )}

      {conError.length > 0 && (
        <p className="text-[0.85rem] text-destructive">
          Corrige las filas con error o quítales la marca para dejarlas fuera.
        </p>
      )}
      {errorEnvio && <p className="text-[0.88rem] text-destructive">{errorEnvio}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onVolver} disabled={enviando}>
          Elegir otro archivo
        </Button>
        <Button
          type="button"
          onClick={confirmar}
          disabled={enviando || incluidas.length === 0 || conError.length > 0}
        >
          {enviando && <Loader2 className="animate-spin" />}
          Cargar {incluidas.length} {incluidas.length === 1 ? "cuenta" : "cuentas"}
        </Button>
      </DialogFooter>
    </div>
  );
}
