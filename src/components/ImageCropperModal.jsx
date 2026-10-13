import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Crop, RotateCw, ZoomIn, ZoomOut, Check, X, RefreshCw, Move } from 'lucide-react';

export default function ImageCropperModal({
  imageSrc,
  onCropComplete,
  onCancel,
  onRetake,
  title = 'Crop & Adjust Photo',
  targetType = 'photo'
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [aspectPreset, setAspectPreset] = useState(() => {
    if (targetType === 'profile' || targetType === '1:1' || targetType === 'avatar') return '1:1';
    if (targetType === 'photo') return '3:4';
    return 'landscape';
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Position offset (pan) in container coordinates
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [baseDimensions, setBaseDimensions] = useState({ width: 0, height: 0 });

  const computeAndSetDimensions = useCallback((naturalWidth, naturalHeight) => {
    if (!naturalWidth || !naturalHeight) return;
    const container = containerRef.current;
    const cWidth = (container && container.clientWidth > 50) ? container.clientWidth : 500;
    const cHeight = (container && container.clientHeight > 50) ? container.clientHeight : 300;

    // Scale so the image comfortably fills the container
    const fitRatio = Math.min((cWidth * 0.9) / naturalWidth, (cHeight * 0.9) / naturalHeight);
    const baseW = Math.max(50, Math.round(naturalWidth * fitRatio));
    const baseH = Math.max(50, Math.round(naturalHeight * fitRatio));

    setBaseDimensions({ width: baseW, height: baseH });
    setImgLoaded(true);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, []);

  // Handle Image Load
  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    computeAndSetDimensions(naturalWidth, naturalHeight);
  };

  // Immediate check if cached image is already complete
  useEffect(() => {
    if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
      computeAndSetDimensions(imageRef.current.naturalWidth, imageRef.current.naturalHeight);
    }
  }, [imageSrc, computeAndSetDimensions]);

  // Dragging / Panning handlers
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY
    });
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  // Rotate clockwise in 90 degree increments
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Zoom control
  const handleZoomChange = (newZoom) => {
    setZoom(Math.min(Math.max(newZoom, 0.4), 4.0));
  };

  // Reset adjustments
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Wheel zoom handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((prev) => Math.min(Math.max(prev + delta, 0.4), 4.0));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Perform Final Crop on Canvas with Exact Coordinate Mapping
  const handleApplyCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;
    setIsProcessing(true);

    try {
      const container = containerRef.current;
      const cropBox = container.querySelector('#crop-viewport-box');
      if (!cropBox) {
        setIsProcessing(false);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const cropRect = cropBox.getBoundingClientRect();

      // Output Canvas Size
      let outWidth = 600;
      let outHeight = 800; // 3:4 default
      if (aspectPreset === '1:1') {
        outWidth = 600;
        outHeight = 600;
      } else if (aspectPreset === 'landscape') {
        outWidth = 800;
        outHeight = 600;
      }

      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // White canvas background fill
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outWidth, outHeight);

      // Center of output canvas
      ctx.save();
      ctx.translate(outWidth / 2, outHeight / 2);

      const scaleX = outWidth / cropRect.width;
      const scaleY = outHeight / cropRect.height;

      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;
      const cropCenterX = cropRect.left + cropRect.width / 2;
      const cropCenterY = cropRect.top + cropRect.height / 2;

      const deltaX = (containerCenterX - cropCenterX) + pan.x;
      const deltaY = (containerCenterY - cropCenterY) + pan.y;

      ctx.translate(deltaX * scaleX, deltaY * scaleY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom * scaleX, zoom * scaleY);

      const drawW = baseDimensions.width;
      const drawH = baseDimensions.height;

      ctx.drawImage(imageRef.current, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      canvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (blob && onCropComplete) {
            onCropComplete(blob, croppedDataUrl);
          }
        },
        'image/jpeg',
        0.95
      );
    } catch (err) {
      console.error('Error during image crop:', err);
      setIsProcessing(false);
    }
  };

  // Dimensions of viewport box based on selected aspect ratio
  const getCropBoxStyles = () => {
    if (aspectPreset === '1:1') {
      return 'w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] aspect-square';
    }
    if (aspectPreset === '3:4') {
      return 'w-[180px] h-[240px] sm:w-[210px] sm:h-[280px] aspect-[3/4]';
    }
    return 'w-[240px] h-[180px] sm:w-[280px] sm:h-[210px] aspect-[4/3]'; // landscape (4:3)
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 flex min-h-screen animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3 relative m-auto animate-in zoom-in-95 duration-200 text-slate-900 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">Drag to position, zoom, and fit face in the frame</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Presets Bar */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Crop Preset:</span>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setAspectPreset('1:1')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                aspectPreset === '1:1' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Square (1:1)
            </button>
            <button
              type="button"
              onClick={() => setAspectPreset('3:4')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                aspectPreset === '3:4' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Passport (3:4)
            </button>
            <button
              type="button"
              onClick={() => setAspectPreset('landscape')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                aspectPreset === 'landscape' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Landscape
            </button>
          </div>
        </div>

        {/* Interactive Cropping Workspace Area */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative rounded-2xl overflow-hidden bg-slate-950 w-full h-[260px] sm:h-[300px] flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing border-2 border-slate-800 shadow-inner"
        >
          {/* Target Image with Exact Geometric Transforms */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rotation}deg) scale(${zoom})`,
              transformOrigin: 'center center',
              pointerEvents: 'none'
            }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Source"
              onLoad={handleImageLoad}
              style={{
                width: baseDimensions.width ? `${baseDimensions.width}px` : 'auto',
                height: baseDimensions.height ? `${baseDimensions.height}px` : 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                display: 'block'
              }}
              className="select-none pointer-events-none drop-shadow-md"
              crossOrigin="anonymous"
              draggable={false}
            />
          </div>

          {/* Dimmed Overlay with Clear Center Cutout */}
          <div className="absolute inset-0 bg-slate-950/60 pointer-events-none flex items-center justify-center">
            {/* Viewport Box */}
            <div
              id="crop-viewport-box"
              className={`relative border-2 border-dashed border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.65)] rounded-2xl pointer-events-none ${getCropBoxStyles()} flex items-center justify-center`}
            >
              {/* Rule of Thirds Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>

              {/* Passport Face Guide Oval Outline (when 3:4 preset) */}
              {aspectPreset === '3:4' && (
                <div className="absolute w-28 h-36 sm:w-32 sm:h-42 border border-white/40 rounded-full pointer-events-none" />
              )}

              {/* Circle Avatar Outline (when 1:1 preset) */}
              {aspectPreset === '1:1' && (
                <div className="absolute inset-2 border border-white/40 rounded-full pointer-events-none" />
              )}

              {/* Corner Accents */}
              <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-rose-500" />
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-rose-500" />
              <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-rose-500" />
              <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-rose-500" />

              {/* Hint badge */}
              <div className="absolute bottom-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider flex items-center gap-1 opacity-80">
                <Move className="w-2.5 h-2.5" />
                <span>Drag to align</span>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar Controls: Zoom Slider, Rotate, Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
          
          {/* Zoom Slider */}
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <ZoomOut
              className="w-4 h-4 text-slate-500 shrink-0 cursor-pointer hover:text-slate-800"
              onClick={() => handleZoomChange(zoom - 0.15)}
            />
            <input
              type="range"
              min="0.4"
              max="4.0"
              step="0.05"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <ZoomIn
              className="w-4 h-4 text-slate-500 shrink-0 cursor-pointer hover:text-slate-800"
              onClick={() => handleZoomChange(zoom + 0.15)}
            />
            <span className="font-mono text-[10px] text-slate-500 font-bold w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRotate}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm transition cursor-pointer"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Rotate</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-600 font-semibold text-xs transition cursor-pointer"
              title="Reset Zoom and Rotation"
            >
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {onRetake ? (
            <button
              type="button"
              onClick={onRetake}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake Photo</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <span>Cropping...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Crop & Use Photo</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
