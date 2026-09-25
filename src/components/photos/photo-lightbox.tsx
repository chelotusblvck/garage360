"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkOrderPhoto } from "@/app/actions/customers";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PHOTO_STAGE_LABEL, PHOTO_STAGE_SHORT } from "@/lib/customers/shared";
import type { CustomerMotorcycle, WorkOrderPhoto } from "@/lib/customers/types";
import { formatDateTime, formatPlate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  photos: WorkOrderPhoto[];
  /** `null` = cerrado. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Para mostrar la moto de cada foto (ficha del cliente). */
  motoById?: Map<string, CustomerMotorcycle>;
};

const iconButton = "text-white hover:bg-white/10 hover:text-white";

/** Visor de fotos a pantalla completa: zoom 1:1, flechas del teclado y tira de miniaturas. */
export function PhotoLightbox({ photos, index, onIndexChange, motoById }: Props) {
  const open = index !== null && photos.length > 0;
  // Si se borró la última foto de la lista, queda en la anterior.
  const current = open ? Math.min(index, photos.length - 1) : 0;
  const photo = open ? photos[current] : null;

  const go = (delta: number) => {
    if (!open) return;
    onIndexChange((current + delta + photos.length) % photos.length);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-neutral-950 p-0 text-white ring-0 sm:max-w-none"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {photo ? (
          <LightboxBody
            // Reinicia el zoom al cambiar de foto.
            key={photo.id}
            photo={photo}
            position={`${current + 1} / ${photos.length}`}
            moto={motoById?.get(photo.motorcycle_id) ?? null}
            onPrev={photos.length > 1 ? () => go(-1) : undefined}
            onNext={photos.length > 1 ? () => go(1) : undefined}
            onDeleted={() => {
              if (photos.length <= 1) onIndexChange(null);
            }}
          />
        ) : null}

        {photos.length > 1 ? (
          <ol className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 p-3" aria-label="Miniaturas">
            {photos.map((p, i) => (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === current}
                  className={cn(
                    "block h-14 w-20 overflow-hidden rounded-md opacity-50 ring-2 ring-transparent transition outline-none hover:opacity-100 focus-visible:ring-white/60",
                    i === current && "opacity-100 ring-white"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LightboxBody({
  photo,
  position,
  moto,
  onPrev,
  onNext,
  onDeleted,
}: {
  photo: WorkOrderPhoto;
  position: string;
  moto: CustomerMotorcycle | null;
  onPrev?: () => void;
  onNext?: () => void;
  onDeleted: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  async function handleDelete() {
    const ok = await confirm({
      title: "¿Eliminar esta foto?",
      description: "Se borra de la evidencia de la orden de trabajo. No se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    const result = await deleteWorkOrderPhoto(photo.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Foto eliminada");
    onDeleted();
  }

  const extension = photo.url.startsWith("data:image/svg") ? "svg" : "webp";

  return (
    <>
      <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-4 py-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <DialogTitle className="truncate text-base text-white">{photo.caption ?? PHOTO_STAGE_LABEL[photo.stage]}</DialogTitle>
          <DialogDescription className="truncate text-xs text-white/60">
            <Link href={`/dashboard/orders/${photo.work_order_id}`} className="font-mono text-white/80 hover:underline">
              {photo.folio}
            </Link>
            {" · "}
            {PHOTO_STAGE_SHORT[photo.stage]} · {formatDateTime(new Date(photo.created_at))}
            {moto ? ` · ${moto.brand} ${moto.model} ${formatPlate(moto.plate)}` : ""}
            {" · "}
            {position}
          </DialogDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={iconButton}
            onClick={() => setZoomed((z) => !z)}
            aria-pressed={zoomed}
            aria-label={zoomed ? "Ajustar a la pantalla" : "Ver a tamaño real"}
          >
            {zoomed ? <ZoomOut /> : <ZoomIn />}
          </Button>
          <a
            href={photo.url}
            download={`${photo.folio}-${photo.stage}.${extension}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-white hover:bg-white/10"
            aria-label="Descargar foto"
          >
            <Download className="size-4" />
          </a>
          <Button variant="ghost" size="icon" className={iconButton} onClick={handleDelete} disabled={deleting} aria-label="Eliminar foto">
            {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          </Button>
          <DialogClose render={<Button variant="ghost" size="icon" className={iconButton} aria-label="Cerrar visor" />}>
            <X />
          </DialogClose>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className={cn("size-full", zoomed ? "overflow-auto" : "flex items-center justify-center p-2 sm:p-6")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- visor de alta resolución */}
          <img
            src={photo.url}
            alt={photo.caption ?? PHOTO_STAGE_LABEL[photo.stage]}
            onDoubleClick={() => setZoomed((z) => !z)}
            className={cn(
              "select-none",
              zoomed ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"
            )}
          />
        </div>
        {onPrev ? (
          <Button
            variant="ghost"
            size="icon-lg"
            className={cn(iconButton, "absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/40")}
            onClick={onPrev}
            aria-label="Foto anterior"
          >
            <ChevronLeft />
          </Button>
        ) : null}
        {onNext ? (
          <Button
            variant="ghost"
            size="icon-lg"
            className={cn(iconButton, "absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/40")}
            onClick={onNext}
            aria-label="Foto siguiente"
          >
            <ChevronRight />
          </Button>
        ) : null}
      </div>
      {confirmDialog}
    </>
  );
}
