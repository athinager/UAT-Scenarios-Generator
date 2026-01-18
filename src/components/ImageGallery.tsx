import { useState, useRef, useEffect } from 'react';
import { UploadedImage } from '../App';
import Card from './Card';
import CardHeader from './CardHeader';
import CardBody from './CardBody';
import './ImageGallery.css';

interface ImageGalleryProps {
  images: UploadedImage[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onReorder: (images: UploadedImage[]) => void;
  onRename: (id: string, newName: string) => void;
}

function ImageGallery({ images, onRemove, onClear, onReorder, onRename }: ImageGalleryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    dragOverIndex.current = null;
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    // Remove drag-over class from all items
    document.querySelectorAll('.gallery-item').forEach((el) => {
      el.classList.remove('drag-over');
    });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIndex.current = index;
    
    // Add visual feedback
    document.querySelectorAll('.gallery-item').forEach((el) => {
      el.classList.remove('drag-over');
    });
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragId = draggedId || e.dataTransfer.getData('text/html');
    
    if (!dragId) return;

    const dragIndex = images.findIndex((img) => img.id === dragId);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggedId(null);
      dragOverIndex.current = null;
      return;
    }

    const reorderedImages = Array.from(images);
    const [reorderedItem] = reorderedImages.splice(dragIndex, 1);
    reorderedImages.splice(dropIndex, 0, reorderedItem);

    const updatedImages = reorderedImages.map((img, index) => ({
      ...img,
      order: index,
    }));

    onReorder(updatedImages);
    setDraggedId(null);
    dragOverIndex.current = null;
  };

  const startEditing = (image: UploadedImage) => {
    setEditingId(image.id);
    setEditingValue(image.name);
  };

  const finishEditing = (id: string) => {
    if (editingValue.trim()) {
      onRename(id, editingValue.trim());
    }
    setEditingId(null);
    setEditingValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      finishEditing(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingValue('');
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <Card className="image-gallery-card">
      <CardHeader>
        <h2>
          Uploaded Images{' '}
          <span aria-live="polite" aria-atomic="true">
            ({images.length})
          </span>
        </h2>
        <button
          type="button"
          className="clear-button"
          onClick={onClear}
          aria-label="Clear all images"
        >
          Clear All
        </button>
      </CardHeader>

      <CardBody>
        <div className="gallery-grid">
          {images.map((image, index) => (
          <div
            key={image.id}
            draggable
            onDragStart={(e) => handleDragStart(e, image.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={`gallery-item ${draggedId === image.id ? 'dragging' : ''}`}
          >
            <div className="gallery-item-header">
              {editingId === image.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="image-label-input"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => finishEditing(image.id)}
                  onKeyDown={(e) => handleKeyDown(e, image.id)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label="Edit screen name"
                />
              ) : (
                <div 
                  className="image-label" 
                  onClick={(e) => {
                    const timeSinceMouseDown = Date.now() - (e.currentTarget as any).__mouseDownTime || 0;
                    if (timeSinceMouseDown < 200) {
                      e.stopPropagation();
                      startEditing(image);
                    }
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as any).__mouseDownTime = Date.now();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      startEditing(image);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Screen name: ${image.name}. Click to edit.`}
                >
                  {image.name}
                </div>
              )}
              <div className="gallery-item-controls">
                <div
                  className="drag-handle"
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="9" cy="12" r="1" />
                    <circle cx="9" cy="5" r="1" />
                    <circle cx="9" cy="19" r="1" />
                    <circle cx="15" cy="12" r="1" />
                    <circle cx="15" cy="5" r="1" />
                    <circle cx="15" cy="19" r="1" />
                  </svg>
                </div>
                <button
                  type="button"
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(image.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label={`Remove ${image.name}`}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
            <img
              src={image.preview}
              alt={image.name}
              className="gallery-thumbnail"
            />
          </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export default ImageGallery;
