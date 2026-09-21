/** Client-side form model for the product editor (all money as UAH strings, exactly what the admin types). */
export type VariantForm = {
  key: string; id?: string; sku: string; storage: string; color: string; colorHex: string; condition: "NEW" | "LIKE_NEW" | "EXCELLENT" | "GOOD" | "FAIR";
  simType: string; connectivity: string; price: string; compareAtPrice: string; costPrice: string; warrantyMonths: number; weightGrams: number; isActive: boolean;
  stock: number; reserved: number; lowStockThreshold: number;
  used: UsedForm; secret: SecretForm; hasSecretPermission: boolean;
};
export type UsedForm = {
  status: string; batteryHealth: string; cycleCount: string; deviceGrade: string; physicalCondition: string; screenCondition: string;
  cameraCondition: string; faceIdStatus: string; touchIdStatus: string; trueToneStatus: string; speakerStatus: string; microphoneStatus: string;
  chargingPortStatus: string; wifiStatus: string; bluetoothStatus: string; simStatus: string; accessoriesIncluded: string; warrantyMonths: number; defects: string; inspectionNotes: string;
};
export type SecretForm = { imei: string; serial: string; purchaseCost: string; purchaseSource: string; supplier: string; internalNotes: string; checklist: { item: string; passed: boolean; note: string }[] };
export type ImageForm = { id?: string; url: string; publicId?: string; alt: string; variantKey: string | null; isPrimary: boolean };
export type ProductForm = {
  id?: string; title: string; slug: string; brand: string; model: string; categoryId: string; description: string; shortDescription: string; sku: string; barcode: string;
  isActive: boolean; isFeatured: boolean; isNew: boolean; seoTitle: string; seoDescription: string;
  specifications: { group: string; items: { label: string; value: string }[] }[]; faq: { q: string; a: string }[];
  variants: VariantForm[]; images: ImageForm[];
};

export const DEFAULT_CHECKLIST = ["Face ID / Touch ID", "Дисплей (мертві пікселі, Touch)", "Камери (фото/відео/стабілізація)", "Динаміки та мікрофони", "Wi-Fi / Bluetooth / GPS", "Зарядка та порт", "SIM / eSIM", "Кнопки та вібро", "Перевірка iCloud / Activation Lock", "Перевірка на заміну деталей"];

export const emptyUsed = (): UsedForm => ({
  status: "DRAFT", batteryHealth: "", cycleCount: "", deviceGrade: "", physicalCondition: "", screenCondition: "", cameraCondition: "NOT_TESTED", faceIdStatus: "NOT_TESTED",
  touchIdStatus: "NOT_APPLICABLE", trueToneStatus: "NOT_TESTED", speakerStatus: "NOT_TESTED", microphoneStatus: "NOT_TESTED", chargingPortStatus: "NOT_TESTED",
  wifiStatus: "NOT_TESTED", bluetoothStatus: "NOT_TESTED", simStatus: "NOT_TESTED", accessoriesIncluded: "", warrantyMonths: 3, defects: "", inspectionNotes: "",
});
export const emptySecret = (): SecretForm => ({ imei: "", serial: "", purchaseCost: "", purchaseSource: "", supplier: "", internalNotes: "", checklist: DEFAULT_CHECKLIST.map((item) => ({ item, passed: false, note: "" })) });

export const newKey = () => Math.random().toString(36).slice(2, 10);
export const emptyVariant = (): VariantForm => ({
  key: newKey(), sku: "", storage: "", color: "", colorHex: "", condition: "NEW", simType: "", connectivity: "", price: "", compareAtPrice: "", costPrice: "", warrantyMonths: 12, weightGrams: 400,
  isActive: true, stock: 0, reserved: 0, lowStockThreshold: 2, used: emptyUsed(), secret: emptySecret(), hasSecretPermission: true,
});
export const emptyProduct = (categoryId = ""): ProductForm => ({
  title: "", slug: "", brand: "Apple", model: "", categoryId, description: "", shortDescription: "", sku: "", barcode: "", isActive: false, isFeatured: false, isNew: true,
  seoTitle: "", seoDescription: "", specifications: [], faq: [], variants: [emptyVariant()], images: [],
});

/** Convert the form model into the JSON payload validated by productPayloadSchema on the server. */
export function toPayload(f: ProductForm) {
  return {
    ...f,
    variants: f.variants.map((v) => ({
      id: v.id, key: v.key, sku: v.sku, storage: v.storage, color: v.color, colorHex: v.colorHex, condition: v.condition, simType: v.simType, connectivity: v.connectivity,
      price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, warrantyMonths: v.warrantyMonths, weightGrams: v.weightGrams, isActive: v.isActive, stock: v.stock, lowStockThreshold: v.lowStockThreshold,
      used: v.condition === "NEW" ? undefined : {
        ...v.used, batteryHealth: v.used.batteryHealth === "" ? null : Number(v.used.batteryHealth), cycleCount: v.used.cycleCount === "" ? null : Number(v.used.cycleCount),
        deviceGrade: v.used.deviceGrade || null, physicalCondition: v.used.physicalCondition || null, screenCondition: v.used.screenCondition || null,
        accessoriesIncluded: v.used.accessoriesIncluded.split(",").map((s) => s.trim()).filter(Boolean),
      },
      secret: v.condition === "NEW" || !v.hasSecretPermission ? undefined : { ...v.secret, checklist: v.secret.checklist.map((c) => ({ ...c, note: c.note || undefined })) },
    })),
    images: f.images.map((i) => ({ ...i, variantKey: i.variantKey || null })),
  };
}
