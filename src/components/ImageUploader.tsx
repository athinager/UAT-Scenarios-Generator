import { useState, useCallback, useRef, DragEvent } from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import CardBody from './CardBody';
import './ImageUploader.css';

interface ImageUploaderProps {
  onImagesAdded: (files: File[]) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function ImageUploader({ onImagesAdded, showToast }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFiles = useCallback((files: FileList | File[]): File[] => {
    const validFiles: File[] = [];
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        showToast(`File ${file.name} is not a supported format. Please use PNG, JPG, or WebP.`, 'error');
        continue;
      }
      validFiles.push(file);
    }
    
    return validFiles;
  }, [showToast]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles = validateFiles(files);
    if (validFiles.length > 0) {
      onImagesAdded(validFiles);
      showToast(`Added ${validFiles.length} image(s)`, 'success');
    }
  }, [validateFiles, onImagesAdded, showToast]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  }, [handleFiles]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Card className="image-uploader-card">
      <CardHeader>
        <h2>Upload Images</h2>
      </CardHeader>
      <CardBody className="card-body-upload">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Drag and drop images here or click to select files"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleButtonClick();
            }
          }}
        >
          <div className="drop-zone-content">
            <svg
              className="upload-icon"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="drop-zone-text">
              Drag and drop images here or{' '}
              <button
                type="button"
                className="link-button"
                onClick={handleButtonClick}
              >
                browse files
              </button>
            </p>
            <p className="drop-zone-hint">
              Supports PNG, JPG, and WebP formats
            </p>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          onChange={handleFileInputChange}
          className="file-input"
          aria-label="Select image files"
        />
      </CardBody>
    </Card>
  );
}

export default ImageUploader;
