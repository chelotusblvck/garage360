"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createProduct, updateProduct, uploadProductImage } from "@/app/actions/inventory";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatPercent } from "@/lib/format";
import { compressImage } from "@/lib/image";
import type { Product } from "@/lib/inventory/types";
import {
  PRODUCT_IMAGE_TYPES,
  productSchema,
  type ProductFormValues,
  type ProductInput,
} from "@/lib/validations/schemas";

/** Límite del archivo original: se comprime en el navegador antes de subir. */
const ORIGINAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta de producto. */
  product: Product | null;
  categories: string[];
};

export function ProductFormSheet({ open, onOpenChange, product, categories }: ProductFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{product ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          <SheetDescription>
            {product ? `SKU ${product.sku}` : "Alta de repuesto o accesorio en el inventario."}
          </SheetDescription>
        </SheetHeader>
        <ProductForm
          key={product?.id ?? "new"}
          product={product}
          categories={categories}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function toFormValues(product: Product | null): ProductFormValues {
  if (!product) {
    return {
      name: "",
      sku: "",
      category: "",
      description: "",
      cost: null,
      price: undefined as unknown as number,
      stock: 0,
      min_stock: 0,
      image_url: null,
      is_active: true,
    };
  }
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    description: product.description ?? "",
    cost: product.cost,
    price: product.price,
    stock: product.stock,
    min_stock: product.min_stock,
    image_url: product.image_url,
    is_active: product.is_active,
  };
}

function ProductForm({
  product,
  categories,
  onDone,
}: {
  product: Product | null;
  categories: string[];
  onDone: () => void;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;

  // Imagen: archivo local pendiente de subir + vista previa.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const objectUrl = useRef<string | null>(null);

  // Libera la object URL de la vista previa al desmontar.
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function selectImage(file: File | null) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = file ? URL.createObjectURL(file) : null;
    setImageFile(file);
    setPreview(objectUrl.current);
  }

  const [price, cost] = useWatch({ control, name: ["price", "cost"] });
  const margin =
    typeof price === "number" && price > 0 && typeof cost === "number" && !Number.isNaN(cost)
      ? (price - cost) / price
      : null;

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError("image_url", { message: "Formato no soportado (JPG, PNG, WebP o AVIF)" });
      return;
    }
    if (file.size > ORIGINAL_IMAGE_MAX_BYTES) {
      setError("image_url", { message: "La imagen es demasiado grande (máx. 15 MB)" });
      return;
    }
    form.clearErrors("image_url");
    selectImage(file);
  }

  function removeImage() {
    selectImage(null);
    setValue("image_url", null, { shouldDirty: true });
    if (fileInput.current) fileInput.current.value = "";
  }

  function applyServerErrors(fieldErrors?: Record<string, string[] | undefined>) {
    for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
      if (messages?.[0] && field !== "_form") {
        setError(field as Path<ProductFormValues>, { message: messages[0] }, { shouldFocus: true });
      }
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    let imageUrl = values.image_url;

    if (imageFile) {
      const data = new FormData();
      data.append("file", await compressImage(imageFile));
      const upload = await uploadProductImage(data);
      if (!upload.ok) {
        setError("image_url", { message: upload.error });
        return;
      }
      imageUrl = upload.data.url;
    }

    const payload = { ...values, image_url: imageUrl };
    const result = product ? await updateProduct(product.id, payload) : await createProduct(payload);

    if (!result.ok) {
      applyServerErrors(result.fieldErrors);
      toast.error(result.error);
      return;
    }

    toast.success(product ? "Producto actualizado" : `«${result.data.name}» agregado al inventario`);
    onDone();
  });

  const listId = id("categories");

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 gap-5 overflow-y-auto p-4">
        {/* Imagen */}
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vista previa del producto" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="grid gap-1.5">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <ImagePlus data-icon="inline-start" />
                {preview ? "Cambiar imagen" : "Subir imagen"}
              </Button>
              {preview ? (
                <Button type="button" variant="ghost" size="sm" onClick={removeImage}>
                  <Trash2 data-icon="inline-start" />
                  Quitar
                </Button>
              ) : null}
            </div>
            {errors.image_url?.message ? (
              <p role="alert" className="text-xs text-destructive">{errors.image_url.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Se optimiza automáticamente.</p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={PRODUCT_IMAGE_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-label="Archivo de imagen"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        </div>

        <Field label="Nombre" htmlFor={id("name")} error={errors.name?.message}>
          <Input
            {...fieldAria(id("name"), errors.name?.message)}
            {...register("name")}
            placeholder="Ej: Pastillas de freno delanteras"
            autoFocus={!product}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" htmlFor={id("sku")} error={errors.sku?.message}>
            <Input
              {...fieldAria(id("sku"), errors.sku?.message)}
              {...register("sku")}
              placeholder="BRK-PAD-F01"
              className="font-mono uppercase"
              autoCapitalize="characters"
            />
          </Field>
          <Field label="Categoría" htmlFor={id("category")} error={errors.category?.message}>
            <Input
              {...fieldAria(id("category"), errors.category?.message)}
              {...register("category")}
              list={listId}
              placeholder="Ej: Frenos"
              autoComplete="off"
            />
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Descripción" htmlFor={id("description")} error={errors.description?.message}>
          <Textarea
            {...fieldAria(id("description"), errors.description?.message)}
            {...register("description")}
            rows={3}
            placeholder="Compatibilidad, especificaciones, marca…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Precio de compra" htmlFor={id("cost")} error={errors.cost?.message} hint="Opcional. Para calcular margen.">
            <Input
              {...fieldAria(id("cost"), errors.cost?.message, true)}
              {...register("cost", {
                setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
              })}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
            />
          </Field>
          <Field
            label="Precio de venta"
            htmlFor={id("price")}
            error={errors.price?.message}
            hint={margin !== null ? `Margen ${formatPercent(margin).replace("+", "")}` : undefined}
          >
            <Input
              {...fieldAria(id("price"), errors.price?.message, margin !== null)}
              {...register("price", { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={product ? "Stock actual" : "Stock inicial"}
            htmlFor={id("stock")}
            error={errors.stock?.message}
            hint={product ? "Si lo cambias se registra como ajuste." : "Se registra como ingreso inicial."}
          >
            <Input
              {...fieldAria(id("stock"), errors.stock?.message, true)}
              {...register("stock", { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
            />
          </Field>
          <Field
            label="Stock mínimo"
            htmlFor={id("min_stock")}
            error={errors.min_stock?.message}
            hint="Por debajo se genera alerta."
          >
            <Input
              {...fieldAria(id("min_stock"), errors.min_stock?.message, true)}
              {...register("min_stock", { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input type="checkbox" {...register("is_active")} className="mt-0.5 size-4 accent-foreground" />
          <span className="grid gap-0.5">
            <span className="font-medium">Visible en la tienda online</span>
            <span className="text-xs text-muted-foreground">
              Si lo desactivas, el producto sigue en inventario pero no aparece en el catálogo.
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 p-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          {product ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
