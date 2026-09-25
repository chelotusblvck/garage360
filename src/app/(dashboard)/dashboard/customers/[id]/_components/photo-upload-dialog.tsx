"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadWorkOrderPhoto } from "@/app/actions/customers";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PHOTO_STAGE_LABEL, PHOTO_STAGES } from "@/lib/customers/shared";
import type { CustomerMotorcycle, ServiceRecord } from "@/lib/customers/types";
import { formatDate, formatPlate } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { WORK_ORDER_PHOTO_TYPES, type PhotoStage } from "@/lib/validations/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** OTs del cliente (sin canceladas), de la más reciente a la más antigua. */
  orders: ServiceRecord[];
  motoById: Map<string, CustomerMotorcycle>;
  defaultOrderId: string | null;
  defaultStage: PhotoStage;
  onUploaded: (stage: PhotoStage) => void;
};

const MAX_FILES = 12;
/** Límite del archivo original: se redimensiona y comprime antes de subir. */
const ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;
/** Lado mayor de la foto subida: suficiente para revisar detalles en el visor HD. */
const UPLOAD_MAX_SIDE = 2048;

type Pending = { id: string; file: File; preview: string };

export function PhotoUploadDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subir fotos de inspección</DialogTitle>
          <DialogDescription>Quedan asociadas a la orden de trabajo y a la etapa elegida.</DialogDescription>
        </DialogHeader>
        <UploadForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

const ACTIVE = new Set(["open", "in_progress", "waiting_parts", "completed"]);

function UploadForm({ orders, motoById, defaultOrderId, defaultStage, onOpenChange, onUploaded }: Props) {
  const uid = useId();
  const [orderId, setOrderId] = useState(
    () => defaultOrderId ?? orders.find((o) => ACTIVE.has(o.status))?.id ?? orders[0]?.id ?? ""
  );
  const [stage, setStage] = useState<PhotoStage>(defaultStage);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Libera las vistas previas al cerrar el diálogo.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    const tooBig = images.filter((f) => f.size > ORIGINAL_MAX_BYTES);
    if (images.length < incoming.length) toast.error("Solo se aceptan imágenes");
    if (tooBig.length) toast.error(`${tooBig.length} archivo(s) superan los 25 MB`);

    const accepted = images.filter((f) => f.size <= ORIGINAL_MAX_BYTES).slice(0, MAX_FILES - files.length);
    if (images.length - tooBig.length > accepted.length) toast.warning(`Máximo ${MAX_FILES} fotos por carga`);
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
    ]);
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function handleUpload() {
    if (!orderId || files.length === 0) return;
    setProgress({ done: 0, total: files.length });
    let failed = 0;
    let lastError = "";

    for (const [i, item] of files.entries()) {
      const file = await compressImage(item.file, UPLOAD_MAX_SIDE, 0.85);
      if (!(WORK_ORDER_PHOTO_TYPES as readonly string[]).includes(file.type)) {
        failed++;
        lastError = `${item.file.name}: formato no soportado`;
      } else {
        const result = await uploadWorkOrderPhoto(orderId, file, stage, caption || null);
        if (!result.ok) {
          failed++;
          lastError = result.error;
        }
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setProgress(null);
    const uploaded = files.length - failed;
    if (failed) toast.error(`${failed} foto(s) no se pudieron subir. ${lastError}`);
    if (uploaded) {
      toast.success(uploaded === 1 ? "Foto subida" : `${uploaded} fotos subidas`);
      onUploaded(stage);
      onOpenChange(false);
    }
  }

  const uploading = progress !== null;

  return (
    <>
      <div className="-mx-4 grid min-h-0 content-start gap-4 overflow-y-auto px-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orden de trabajo" htmlFor={`${uid}-order`}>
            <NativeSelect id={`${uid}-order`} value={orderId} onChange={(e) => setOrderId(e.target.value)} className="w-full" disabled={uploading}>
              {orders.map((o) => {
                const moto = motoById.get(o.motorcycle_id);
                return (
                  <NativeSelectOption key={o.id} value={o.id}>
                    {o.folio} · {moto ? `${moto.model} ${formatPlate(moto.plate)}` : ""} · {WORK_ORDER_STATUS_LABEL[o.status]} ({formatDate(new Date(o.created_at))})
                  </NativeSelectOption>
                );
              })}
            </NativeSelect>
          </Field>
          <Field label="Descripción (opcional)" htmlFor={`${uid}-caption`} hint="Se aplica a todas las fotos de esta carga.">
            <Input
              id={`${uid}-caption`}
              aria-describedby={`${uid}-caption-hint`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={140}
              placeholder="Ej: Rayón en carenado izquierdo"
              disabled={uploading}
            />
          </Field>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Etapa</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Etapa de la foto">
            {PHOTO_STAGES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={stage === s}
                onClick={() => setStage(s)}
                disabled={uploading}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm ring-1 ring-foreground/10 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  stage === s ? "bg-foreground text-background" : "bg-card hover:bg-muted"
                )}
              >
                {PHOTO_STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "grid justify-items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-foreground/15"
          )}
        >
          <Upload className="size-6 text-muted-foreground" aria-hidden />
          <div className="grid gap-0.5">
            <p className="text-sm font-medium">Arrastra y suelta las fotos aquí</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP o AVIF · hasta {MAX_FILES} por carga · se optimizan a {UPLOAD_MAX_SIDE}px antes de subir
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => pickerRef.current?.click()} disabled={uploading}>
              <ImagePlus data-icon="inline-start" />
              Elegir archivos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} disabled={uploading}>
              <Camera data-icon="inline-start" />
              Tomar foto
            </Button>
          </div>
          <input
            ref={pickerRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir fotos"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {/* capture: abre directamente la cámara trasera en el celular o tablet. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-label="Tomar foto con la cámara"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos seleccionadas">
            {files.map((f) => (
              <li key={f.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
                <img src={f.preview} alt={f.file.name} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  disabled={uploading}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label={`Quitar ${f.file.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
          Cancelar
        </Button>
        <Button onClick={handleUpload} disabled={uploading || files.length === 0 || !orderId}>
          {uploading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
          {uploading
            ? `Subiendo ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} de ${progress.total}…`
            : files.length > 1
              ? `Subir ${files.length} fotos`
              : "Subir foto"}
        </Button>
      </DialogFooter>
    </>
  );
}
