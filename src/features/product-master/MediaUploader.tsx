import { useRef, useState } from "react";
import { ImagePlus, FileText, X, Loader2 } from "lucide-react";
import type { MediaFile } from "../../types";
import { salesApi } from "../../api/salesApi";

interface Props {
  value: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  ownerId: string;
  label?: string;
  accept?: string;
  hint?: string;
}

function asMediaFile(file: {
  id: string;
  name: string;
  type: string;
  url?: string;
  dataUrl?: string;
  size?: number;
}): MediaFile {
  // 真实服务端返回 url（公网地址，不存 base64）；demo 模式回退 dataUrl。
  const url = file.url ?? file.dataUrl ?? "";
  return {
    id: file.id,
    name: file.name,
    type: file.type || "application/octet-stream",
    url,
    size: file.size,
  };
}

export function MediaUploader({
  value,
  onChange,
  ownerId,
  label = "图片 / 附件",
  accept = "image/*,application/pdf",
  hint = "支持多张图片或 PDF，上传后自动回显",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: MediaFile[] = [];
      for (const file of Array.from(files)) {
        const result = await salesApi.uploadFile(file, ownerId, "product-media");
        uploaded.push(asMediaFile(result.file));
      }
      onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="pm-uploader">
      <div className="pm-uploader-head">
        <span className="pm-uploader-label">{label}</span>
        <button
          type="button"
          className="pm-upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />}
          {uploading ? "上传中…" : "上传"}
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          multiple
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <p className="pm-uploader-hint">{hint}</p>
      {value.length > 0 && (
        <ul className="pm-media-list">
          {value.map((file) => (
            <li key={file.id} className="pm-media-item">
              {file.type.startsWith("image/") ? (
                <img src={file.url} alt={file.name} className="pm-media-thumb" />
              ) : (
                <span className="pm-media-file">
                  <FileText size={20} />
                  <small>{file.name}</small>
                </span>
              )}
              <button
                type="button"
                className="pm-media-remove"
                aria-label={`移除 ${file.name}`}
                onClick={() => onChange(value.filter((f) => f.id !== file.id))}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
