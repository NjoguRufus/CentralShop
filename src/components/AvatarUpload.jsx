// src/components/AvatarUpload.jsx
import React, { useState } from "react";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import { toast } from "react-hot-toast";

export default function AvatarUpload({ value, onChange }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(value || null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const url = await uploadImageToCloudinary(file);
    setLoading(false);
    if (url) {
      setPreview(url);
      onChange(url);
    } else {
      toast.error("Image upload failed");
    }
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border">
        {preview ? <img src={preview} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400">No</div>}
      </div>
      <div className="flex flex-col">
        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-slate-100 rounded shadow-sm hover:bg-slate-200">
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          {loading ? "Uploading..." : "Upload"}
        </label>
        <small className="text-xs text-gray-500">PNG/JPG, max 5MB</small>
      </div>
    </div>
  );
}
