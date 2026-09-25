import "server-only";
import { demoAppointmentRepository } from "@/lib/appointments/demo-repository";
import { demoDb } from "@/lib/demo/db";
import { demoPhotoUrl } from "@/lib/demo/photos";
import { demoWorkOrderRepository } from "@/lib/orders/demo-repository";
import { formatFolio } from "@/lib/orders/workflow";
import { SAMPLE_PHOTO_PREFIX, SAMPLE_SHOT } from "./shared";
import { CheckInError, type CheckInRepository } from "./types";

/* Recepción en memoria (modo demo). Mismas reglas que check_in_work_order(). */

export const demoCheckInRepository: CheckInRepository = {
  async stagePhoto(file) {
    // Sin Storage en modo demo: la foto (ya comprimida en el navegador) se
    // guarda como data URL hasta confirmar la recepción.
    const token = `staged:${crypto.randomUUID()}`;
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    demoDb().stagedPhotos.set(token, `data:${file.type};base64,${base64}`);
    return token;
  },

  async complete(command) {
    const db = demoDb();

    // 1. Resolver todas las fotos antes de crear nada (todo o nada).
    const photos = command.photos.map((photo) => {
      if (photo.token.startsWith(SAMPLE_PHOTO_PREFIX)) return { ...photo, url: null };
      const url = db.stagedPhotos.get(photo.token);
      if (!url) throw new CheckInError("Una de las fotos ya no está disponible. Vuelve a tomarla.", "photos");
      return { ...photo, url };
    });

    // 2. Crear la OT: desde la cita (queda "Atendida") o ingreso espontáneo.
    let orderId: string;
    if (command.appointment_id) {
      if (db.workOrders.some((o) => o.appointment_id === command.appointment_id)) {
        throw new CheckInError("La cita ya fue recepcionada", "appointment_id");
      }
      orderId = await demoAppointmentRepository.convert(command.appointment_id, command.mechanic_id, command.km);
    } else if (command.vehicle) {
      const created = await demoWorkOrderRepository.create({
        ...command.vehicle,
        km: command.km,
        intake_reason: command.intake_reason,
        mechanic_id: command.mechanic_id,
      });
      orderId = created.id;
    } else {
      throw new CheckInError("Identifica la moto", "plate");
    }

    // 3. Datos de la recepción y fotos en la etapa "reception".
    const order = db.workOrders.find((o) => o.id === orderId)!;
    order.fuel_level = command.fuel_level;
    order.intake_reason = command.intake_reason;
    const moto = db.motorcycles.find((m) => m.id === order.motorcycle_id)!;
    const folio = formatFolio(order.number);
    const now = Date.now();

    photos.forEach((photo, i) => {
      db.photos.push({
        id: crypto.randomUUID(),
        work_order_id: orderId,
        stage: "reception",
        url:
          photo.url ??
          demoPhotoUrl({
            shot: SAMPLE_SHOT[photo.slot],
            stage: "reception",
            color: moto.color ?? null,
            plate: moto.plate,
            folio,
            km: command.km,
            label: photo.note ?? "Daño",
          }),
        caption: photo.caption,
        created_at: new Date(now + i).toISOString(),
      });
      if (photo.url) db.stagedPhotos.delete(photo.token);
    });

    return { id: orderId, folio };
  },
};
