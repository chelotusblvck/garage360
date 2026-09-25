import type { CheckInPhotoSlot, FuelLevel, WalkInVehicleInput } from "@/lib/validations/schemas";

export type CheckInPhotoCommand = {
  /** Token del área temporal o "sample:<toma>" (solo demo). */
  token: string;
  slot: CheckInPhotoSlot;
  note: string | null;
  caption: string;
};

/** Recepción completa: se crea la OT y se asocian las fotos en un solo paso. */
export type CheckInCommand = {
  /** Cita de origen (queda "Atendida"); `null` = ingreso espontáneo. */
  appointment_id: string | null;
  vehicle: WalkInVehicleInput | null;
  km: number;
  fuel_level: FuelLevel;
  intake_reason: string;
  mechanic_id: string | null;
  photos: CheckInPhotoCommand[];
};

export type CheckInResult = { id: string; folio: string };

/** Contrato común para Supabase y el modo demo. */
export interface CheckInRepository {
  /** Sube una foto de recepción antes de que exista la OT; devuelve su token. */
  stagePhoto(file: File): Promise<string>;
  complete(command: CheckInCommand): Promise<CheckInResult>;
}

export class CheckInError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "CheckInError";
  }
}
