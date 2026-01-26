import { useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useAppStore, type LoadedModel, type Video360, type ProcessedImage } from '@/store';
import {
  loadModelFromFile,
  loadBackgroundImage,
  autoScaleAndGround,
  isValidModelFile,
  isValidImageFile,
} from '@/AssetLoader';
import {
  createJob,
  pollJobUntilComplete,
  getAssetDownloadUrl,
  checkApiHealth,
  type JobResponse,
} from '@/api';

interface AssetPanelProps {
  onClose: () => void;
}

export function AssetPanel({ onClose }: AssetPanelProps) {
  const modelInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const aiImageInputRef = useRef<HTMLInputElement>(null);

  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  const assets = useAppStore((state) => state.assets);
  const setAssets = useAppStore((state) => state.setAssets);
  const addModel = useAppStore((state) => state.addModel);
  const removeModel = useAppStore((state) => state.removeModel);
  const setBackgroundImage = useAppStore((state) => state.setBackgroundImage);
  const setProcessedImage = useAppStore((state) => state.setProcessedImage);
  const setVideo360 = useAppStore((state) => state.setVideo360);

  // Check API availability on mount
  useState(() => {
    checkApiHealth().then(setApiAvailable);
  });

  const handleModelUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!isValidModelFile(file)) {
        setAssets({ error: 'Please upload a .glb or .gltf file' });
        return;
      }

      setAssets({ isLoading: true, loadingProgress: 0, error: null });

      try {
        const loaded = await loadModelFromFile(file, (progress) => {
          setAssets({ loadingProgress: progress.percent });
        });

        // Auto-scale and ground the model
        const { scale, position } = autoScaleAndGround(loaded.object, loaded.boundingBox);

        const model: LoadedModel = {
          id: loaded.id,
          name: loaded.name,
          object: loaded.object,
          scale,
          position,
        };

        addModel(model);
        setAssets({ isLoading: false, loadingProgress: 100 });
      } catch (error) {
        console.error('Failed to load model:', error);
        setAssets({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load model',
        });
      }

      // Reset input
      if (modelInputRef.current) {
        modelInputRef.current.value = '';
      }
    },
    [setAssets, addModel]
  );

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!isValidImageFile(file)) {
        setAssets({ error: 'Please upload a JPG, PNG, or WebP image' });
        return;
      }

      setAssets({ isLoading: true, loadingProgress: 0, error: null });

      try {
        const loaded = await loadBackgroundImage(file, (progress) => {
          setAssets({ loadingProgress: progress.percent });
        });

        setBackgroundImage(loaded);
        setAssets({ isLoading: false, loadingProgress: 100 });
      } catch (error) {
        console.error('Failed to load image:', error);
        setAssets({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load image',
        });
      }

      // Reset input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    },
    [setAssets, setBackgroundImage]
  );

  const handleVideoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        setAssets({ error: 'Please upload an MP4, WebM, or MOV video file' });
        return;
      }

      setAssets({ isLoading: true, loadingProgress: 0, error: null });

      try {
        // Create video element to get duration
        const video = document.createElement('video');
        video.preload = 'metadata';

        const duration = await new Promise<number>((resolve, reject) => {
          video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            resolve(video.duration);
          };
          video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video metadata'));
          };
          video.src = URL.createObjectURL(file);
        });

        const video360Data: Video360 = {
          id: crypto.randomUUID(),
          name: file.name,
          file,
          size: file.size,
          duration,
          status: 'pending',
        };

        setVideo360(video360Data);
        setAssets({ isLoading: false, loadingProgress: 100 });
      } catch (error) {
        console.error('Failed to load video:', error);
        setAssets({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load video',
        });
      }

      // Reset input
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    },
    [setAssets, setVideo360]
  );

  const handleAIProcessImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!isValidImageFile(file)) {
        setAssets({ error: 'Please upload a JPG, PNG, or WebP image' });
        return;
      }

      setAssets({ isLoading: true, loadingProgress: 0, processingStatus: 'Uploading...', error: null });

      try {
        // Create job and upload image
        const job = await createJob(file);
        setAssets({ loadingProgress: 10, processingStatus: 'Processing image...' });

        // Poll for completion
        const completedJob = await pollJobUntilComplete(
          job.id,
          (status: JobResponse) => {
            setAssets({
              loadingProgress: status.progress,
              processingStatus: status.status === 'processing'
                ? `Processing... ${status.progress}%`
                : status.status,
            });
          }
        );

        if (completedJob.status === 'failed') {
          throw new Error(completedJob.error || 'Processing failed');
        }

        if (!completedJob.outputs) {
          throw new Error('No outputs from processing');
        }

        // Load textures from processed assets
        const textureLoader = new THREE.TextureLoader();

        const colorTexture = await new Promise<THREE.Texture>((resolve, reject) => {
          textureLoader.load(
            getAssetDownloadUrl(completedJob.outputs!.color!),
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              resolve(tex);
            },
            undefined,
            reject
          );
        });

        const depthTexture = await new Promise<THREE.Texture>((resolve, reject) => {
          textureLoader.load(
            getAssetDownloadUrl(completedJob.outputs!.depth!),
            resolve,
            undefined,
            reject
          );
        });

        let maskTexture: THREE.Texture | undefined;
        if (completedJob.outputs.mask) {
          maskTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(
              getAssetDownloadUrl(completedJob.outputs!.mask!),
              resolve,
              undefined,
              reject
            );
          });
        }

        // Get image dimensions from color texture
        const image = colorTexture.image as HTMLImageElement;

        const processedImage: ProcessedImage = {
          id: completedJob.id,
          jobId: completedJob.id,
          name: file.name,
          inputType: completedJob.input_type || 'unknown',
          colorTexture,
          depthTexture,
          maskTexture,
          width: image.width,
          height: image.height,
        };

        setProcessedImage(processedImage);
        setAssets({ isLoading: false, loadingProgress: 100, processingStatus: null });
      } catch (error) {
        console.error('Failed to process image:', error);
        setAssets({
          isLoading: false,
          processingStatus: null,
          error: error instanceof Error ? error.message : 'Failed to process image',
        });
      }

      // Reset input
      if (aiImageInputRef.current) {
        aiImageInputRef.current.value = '';
      }
    },
    [setAssets, setProcessedImage]
  );

  const handleRemoveModel = useCallback(
    (id: string) => {
      removeModel(id);
    },
    [removeModel]
  );

  const handleRemoveBackground = useCallback(() => {
    if (assets.backgroundImage?.url) {
      URL.revokeObjectURL(assets.backgroundImage.url);
    }
    setBackgroundImage(null);
  }, [assets.backgroundImage, setBackgroundImage]);

  const handleRemove360Video = useCallback(() => {
    setVideo360(null);
  }, [setVideo360]);

  const handleRemoveProcessedImage = useCallback(() => {
    if (assets.processedImage) {
      assets.processedImage.colorTexture.dispose();
      assets.processedImage.depthTexture.dispose();
      assets.processedImage.maskTexture?.dispose();
    }
    setProcessedImage(null);
  }, [assets.processedImage, setProcessedImage]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '360px',
        maxHeight: '80vh',
        backgroundColor: 'rgba(10, 10, 21, 0.98)',
        borderRadius: '12px',
        padding: '20px',
        zIndex: 300,
        border: '1px solid #333',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
          Load Assets
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px 8px',
          }}
        >
          x
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={modelInputRef}
        type="file"
        accept=".glb,.gltf"
        style={{ display: 'none' }}
        onChange={handleModelUpload}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        style={{ display: 'none' }}
        onChange={handleVideoUpload}
      />
      <input
        ref={aiImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleAIProcessImage}
      />

      {/* Upload buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <UploadButton
          label="3D Model"
          description=".glb, .gltf"
          onClick={() => modelInputRef.current?.click()}
          disabled={assets.isLoading}
        />
        <UploadButton
          label="Background"
          description="JPG, PNG, WebP"
          onClick={() => imageInputRef.current?.click()}
          disabled={assets.isLoading}
        />
      </div>

      {/* AI Processing button */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => aiImageInputRef.current?.click()}
          disabled={assets.isLoading || apiAvailable === false}
          style={{
            width: '100%',
            padding: '14px 12px',
            backgroundColor: assets.isLoading ? '#1a1a2e' : '#1a1a2e',
            border: '2px solid #6366f1',
            borderRadius: '8px',
            cursor: assets.isLoading || apiAvailable === false ? 'not-allowed' : 'pointer',
            opacity: assets.isLoading || apiAvailable === false ? 0.5 : 1,
            transition: 'border-color 0.2s, background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onMouseOver={(e) => {
            if (!assets.isLoading && apiAvailable !== false) {
              e.currentTarget.style.backgroundColor = '#1e1e3f';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a2e';
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginBottom: '2px' }}>
              Process with AI
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              Generate depth map for parallax effect
            </div>
          </div>
          <div
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              backgroundColor: apiAvailable ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: apiAvailable ? '#22c55e' : '#ef4444',
              borderRadius: '4px',
              fontWeight: 500,
            }}
          >
            {apiAvailable === null ? 'Checking...' : apiAvailable ? 'API Ready' : 'API Offline'}
          </div>
        </button>
      </div>

      {/* 360 Video upload - separate row with "coming soon" indicator */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => videoInputRef.current?.click()}
          disabled={assets.isLoading}
          style={{
            width: '100%',
            padding: '14px 12px',
            backgroundColor: assets.isLoading ? '#1a1a2e' : '#1a1a2e',
            border: '2px dashed #444',
            borderRadius: '8px',
            cursor: assets.isLoading ? 'not-allowed' : 'pointer',
            opacity: assets.isLoading ? 0.5 : 1,
            transition: 'border-color 0.2s, background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onMouseOver={(e) => {
            if (!assets.isLoading) {
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.backgroundColor = '#1e1e3f';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#444';
            e.currentTarget.style.backgroundColor = '#1a1a2e';
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginBottom: '2px' }}>
              360 Video
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>MP4, WebM, MOV</div>
          </div>
          <div
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              borderRadius: '4px',
              fontWeight: 500,
            }}
          >
            For future processing
          </div>
        </button>
      </div>

      {/* Loading indicator */}
      {assets.isLoading && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontSize: '12px',
              color: '#888',
            }}
          >
            <span>{assets.processingStatus || 'Loading...'}</span>
            <span>{Math.round(assets.loadingProgress)}%</span>
          </div>
          <div
            style={{
              height: '4px',
              backgroundColor: '#333',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${assets.loadingProgress}%`,
                backgroundColor: '#6366f1',
                transition: 'width 0.2s',
              }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {assets.error && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#ef4444',
          }}
        >
          {assets.error}
        </div>
      )}

      {/* Loaded models list */}
      {assets.models.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: '12px', fontWeight: 500 }}>
            Loaded Models
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assets.models.map((model) => (
              <AssetItem
                key={model.id}
                name={model.name}
                type="model"
                onRemove={() => handleRemoveModel(model.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Background image */}
      {assets.backgroundImage && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: '12px', fontWeight: 500 }}>
            Background Image
          </h4>
          <AssetItem
            name={assets.backgroundImage.name}
            type="image"
            onRemove={handleRemoveBackground}
          />
        </div>
      )}

      {/* Processed Image with Depth */}
      {assets.processedImage && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: '12px', fontWeight: 500 }}>
            AI Processed Image
          </h4>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: '#1a1a2e',
              borderRadius: '6px',
              border: '1px solid #6366f1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#6366f1',
                  fontWeight: 600,
                }}
              >
                AI
              </div>
              <div>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#fff',
                    display: 'block',
                    maxWidth: '150px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {assets.processedImage.name}
                </span>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {assets.processedImage.inputType} | {assets.processedImage.width}x{assets.processedImage.height}
                </span>
              </div>
            </div>
            <button
              onClick={handleRemoveProcessedImage}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
            >
              x
            </button>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '11px',
              color: '#22c55e',
            }}
          >
            Depth parallax active - move your head to see the effect
          </p>
        </div>
      )}

      {/* 360 Video */}
      {assets.video360 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: '12px', fontWeight: 500 }}>
            360 Video (Pending Processing)
          </h4>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: '#1a1a2e',
              borderRadius: '6px',
              border: '1px solid #444',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#f59e0b',
                }}
              >
                360
              </div>
              <div>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#fff',
                    display: 'block',
                    maxWidth: '150px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {assets.video360.name}
                </span>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {(assets.video360.size / (1024 * 1024)).toFixed(1)} MB
                  {assets.video360.duration && ` | ${Math.round(assets.video360.duration)}s`}
                </span>
              </div>
            </div>
            <button
              onClick={handleRemove360Video}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
            >
              x
            </button>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '11px',
              color: '#666',
              fontStyle: 'italic',
            }}
          >
            Backend processing will be available in Phase 5
          </p>
        </div>
      )}

      {/* Empty state */}
      {assets.models.length === 0 && !assets.backgroundImage && !assets.processedImage && !assets.video360 && !assets.isLoading && (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#666',
            fontSize: '13px',
          }}
        >
          No assets loaded yet.
          <br />
          Upload a 3D model or background image to get started.
        </div>
      )}

      {/* Info box */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#888',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: '#6366f1' }}>Tip:</strong> Models are auto-scaled and positioned on
        the floor. Background images appear on the back wall.
      </div>
    </div>
  );
}

interface UploadButtonProps {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function UploadButton({ label, description, onClick, disabled }: UploadButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '16px 12px',
        backgroundColor: disabled ? '#1a1a2e' : '#1a1a2e',
        border: '2px dashed #333',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.2s, background-color 0.2s',
      }}
      onMouseOver={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = '#6366f1';
          e.currentTarget.style.backgroundColor = '#1e1e3f';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = '#333';
        e.currentTarget.style.backgroundColor = '#1a1a2e';
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '11px', color: '#666' }}>{description}</div>
    </button>
  );
}

interface AssetItemProps {
  name: string;
  type: 'model' | 'image';
  onRemove: () => void;
}

function AssetItem({ name, type, onRemove }: AssetItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        backgroundColor: '#1a1a2e',
        borderRadius: '6px',
        border: '1px solid #333',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            backgroundColor: type === 'model' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
          }}
        >
          {type === 'model' ? (
            <span style={{ color: '#22c55e' }}>&#9649;</span>
          ) : (
            <span style={{ color: '#6366f1' }}>&#9634;</span>
          )}
        </div>
        <span
          style={{
            fontSize: '13px',
            color: '#fff',
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
      </div>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: '14px',
          transition: 'color 0.2s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
        onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
      >
        x
      </button>
    </div>
  );
}
