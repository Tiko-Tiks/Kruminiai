// Nuotraukų suspaudimas naršyklėje prieš siunčiant į server action.
// Telefono nuotraukos būna 3–8 MB, o viešam puslapiui užtenka ~1600px JPEG.
// Taip ir įkėlimas greitesnis, ir lankytojams puslapis krauna lengvai.
//
// Naudojama tik klientiniuose komponentuose (reikia canvas / createImageBitmap):
// projektų eigos nuotraukoms ir naujienų viršeliams.
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
