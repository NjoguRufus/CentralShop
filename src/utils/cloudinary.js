// src/utils/cloudinary.js
// Simple unsigned upload helper using the Upload Preset.
// NOTE: unsigned preset must be created in Cloudinary dashboard with name "AI-POS".

const CLOUD_NAME = "deokh6i1k";
const UPLOAD_PRESET = "AI-POS";

export async function uploadImageToCloudinary(file) {
  if (!file) return null;
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (data?.secure_url) return data.secure_url;
    console.error("Cloudinary upload failed", data);
    return null;
  } catch (err) {
    console.error("Cloudinary error", err);
    return null;
  }
}
