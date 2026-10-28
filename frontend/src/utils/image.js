/** Shrinks a photo to at most `maxSide` pixels and returns a JPEG Blob (keeps uploads small). */
export async function prepareImage(file, maxSide = 800, quality = 0.85) {
  const unreadable = () => new Error(`“${file.name}” couldn’t be read. Use a JPG or PNG photo.`);
  if (!file.type.startsWith("image/")) throw new Error(`“${file.name}” isn’t an image.`);

  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try { source = await loadWithImgTag(file); } catch { throw unreadable(); }
  }

  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === "function") source.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw unreadable();
  return blob;
}

function loadWithImgTag(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}
