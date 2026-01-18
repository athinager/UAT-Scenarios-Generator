import { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import ImageGallery from './components/ImageGallery';
import ScenarioGenerator from './components/ScenarioGenerator';
import Toast from './components/Toast';
import PageContainer from './components/PageContainer';
import './App.css';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  order: number;
  name: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addImages = useCallback((files: File[]) => {
    const newImages: UploadedImage[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      order: images.length + index,
      name: `Screen ${images.length + index + 1}`,
    }));
    setImages((prev) => [...prev, ...newImages]);
  }, [images.length]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id).map((img, index) => ({
        ...img,
        order: index,
        name: img.name.replace(/Screen \d+/, `Screen ${index + 1}`),
      }));
    });
  }, []);

  const clearImages = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  }, [images]);

  const reorderImages = useCallback((newImages: UploadedImage[]) => {
    setImages(newImages);
  }, []);

  const renameImage = useCallback((id: string, newName: string) => {
    setImages((prev) => prev.map((img) => 
      img.id === id ? { ...img, name: newName || `Screen ${img.order + 1}` } : img
    ));
  }, []);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <PageContainer>
        <header className="app-hero">
          <h1>UAT Scenarios Generator</h1>
          <p className="subtitle">Generate comprehensive test scenarios from UI screenshots</p>
        </header>

        <main id="main-content" className="app-main">
          <div className="workspace-grid">
            <ImageUploader onImagesAdded={addImages} showToast={showToast} />
            {images.length > 0 && (
              <ImageGallery
                images={images}
                onRemove={removeImage}
                onClear={clearImages}
                onReorder={reorderImages}
                onRename={renameImage}
              />
            )}
          </div>
          
          {images.length > 0 && (
            <ScenarioGenerator
              images={images}
              onCopy={showToast}
            />
          )}
        </main>
      </PageContainer>

      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
