"use client";

/* eslint-disable @next/next/no-img-element */
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";

type ImageUploadFieldProps = {
  id: string;
  name?: string;
  label: string;
  buttonLabel: string;
  accept: string;
  allowedTypes: readonly string[];
  maxSizeBytes: number;
  helpText: string;
  validationMessage: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  previewAlt: string;
  showPreview?: boolean;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

function UploadIcon() {
  return (
    <svg className="image-upload-field__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

export function ImageUploadField({
  id,
  name,
  label,
  buttonLabel,
  accept,
  allowedTypes,
  maxSizeBytes,
  helpText,
  validationMessage,
  file,
  onFileChange,
  previewAlt,
  showPreview = true,
  required = false,
  disabled = false,
  loading = false,
  className = "",
}: ImageUploadFieldProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const labelId = `${id}-${generatedId}-label`;
  const descriptionId = `${id}-${generatedId}-description`;
  const filenameId = `${id}-${generatedId}-filename`;
  const errorId = `${id}-${generatedId}-error`;

  const releasePreview = () => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };

  useEffect(() => () => releasePreview(), []);

  useEffect(() => {
    if (!file) {
      releasePreview();
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [file]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (nextFile && (!allowedTypes.includes(nextFile.type) || nextFile.size > maxSizeBytes)) {
      releasePreview();
      setPreviewUrl(null);
      setError(validationMessage);
      event.target.value = "";
      onFileChange(null);
      return;
    }
    releasePreview();
    const nextPreview = nextFile && showPreview ? URL.createObjectURL(nextFile) : null;
    previewUrlRef.current = nextPreview;
    setPreviewUrl(nextPreview);
    setError("");
    onFileChange(nextFile);
  };

  const describedBy = [descriptionId, filenameId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={`image-upload-field ${showPreview ? "image-upload-field--preview" : "image-upload-field--compact"} ${className}`.trim()}>
      <span className="image-upload-field__label" id={labelId}>{label}</span>
      <div className="image-upload-field__control">
        <input
          ref={inputRef}
          className="image-upload-field__input"
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          disabled={disabled || loading}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          onChange={selectFile}
        />
        <label className="image-upload-field__button" htmlFor={id} aria-disabled={disabled || loading}>
          <UploadIcon />
          <span>{loading ? "ENVOI EN COURS…" : buttonLabel}</span>
        </label>
        <span className="image-upload-field__filename" id={filenameId} role="status" aria-live="polite">
          {file ? file.name : "Aucun fichier sélectionné"}
        </span>
      </div>
      {showPreview && file && previewUrl ? (
        <span className="image-upload-field__preview" aria-live="polite">
          <img src={previewUrl} alt={previewAlt} />
        </span>
      ) : null}
      <small className="image-upload-field__help" id={descriptionId}>{helpText}</small>
      {error ? <small className="image-upload-field__error" id={errorId} role="alert">{error}</small> : null}
    </div>
  );
}
