import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Trash2, PenLine, Upload, Image as ImageIcon, RotateCw, RotateCcw } from 'lucide-react';

const SignaturePad = forwardRef(({ onChange }, ref) => {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('draw'); // 'draw' | 'upload'
  const [uploadedImage, setUploadedImage] = useState(null);
  const [rawImageObj, setRawImageObj] = useState(null);
  const [rotationAngle, setRotationAngle] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      padRef.current?.clear();
    };

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: '#4F8EF7',
      minWidth: 1.5,
      maxWidth: 3,
    });

    padRef.current.addEventListener('afterUpdateStroke', () => {
      onChange?.(padRef.current.toDataURL('image/png'));
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useImperativeHandle(ref, () => ({
    getSignatureData: () => {
      if (mode === 'upload') return uploadedImage;
      if (padRef.current?.isEmpty()) return null;
      return padRef.current.toDataURL('image/png');
    },
    clear: () => {
      padRef.current?.clear();
      setUploadedImage(null);
      setRawImageObj(null);
      setRotationAngle(0);
      onChange?.(null);
    },
  }));

  const processSignatureCutout = (sourceCanvasOrImg) => {
    const canvas = document.createElement('canvas');
    const w = sourceCanvasOrImg.width;
    const h = sourceCanvasOrImg.height;
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceCanvasOrImg, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // 1. Build grayscale buffer
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    // 2. Fast separable box blur to estimate local paper lighting
    const radius = Math.max(6, Math.min(22, Math.floor(Math.min(width, height) / 24)));
    const tempBlur = new Float32Array(width * height);
    const bg = new Float32Array(width * height);

    // Horizontal blur pass
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        if (k >= 0 && k < width) {
          sum += gray[y * width + k];
          count++;
        }
      }
      for (let x = 0; x < width; x++) {
        tempBlur[y * width + x] = sum / count;
        const left = x - radius;
        const right = x + radius + 1;
        if (right < width) { sum += gray[y * width + right]; count++; }
        if (left >= 0) { sum -= gray[y * width + left]; count--; }
      }
    }

    // Vertical blur pass
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        if (k >= 0 && k < height) {
          sum += tempBlur[k * width + x];
          count++;
        }
      }
      for (let y = 0; y < height; y++) {
        bg[y * width + x] = sum / count;
        const top = y - radius;
        const bottom = y + radius + 1;
        if (bottom < height) { sum += tempBlur[bottom * width + x]; count++; }
        if (top >= 0) { sum -= tempBlur[top * width + x]; count--; }
      }
    }

    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let i = 0; i < width * height; i++) {
      const g = gray[i];
      const bVal = bg[i];
      const diff = bVal - g;
      const x = i % width;
      const y = Math.floor(i / width);

      // Ink strokes have sharp local contrast vs surrounding paper
      if (diff > 14) {
        const alpha = Math.min(255, Math.max(0, Math.round(diff * 6.5)));
        data[i * 4] = 15;      // Deep midnight slate ink
        data[i * 4 + 1] = 23;
        data[i * 4 + 2] = 42;
        data[i * 4 + 3] = alpha;

        if (alpha > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      } else {
        data[i * 4 + 3] = 0; // 100% transparent paper & shadow
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Tight crop to ink bounding box
    if (maxX > minX && maxY > minY) {
      const pad = 12;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(canvas.width - cropX, (maxX - minX) + pad * 2);
      const cropH = Math.min(canvas.height - cropY, (maxY - minY) + pad * 2);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      return croppedCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  };

  const applyRotationAndCutout = (img, angle) => {
    const rads = (angle * Math.PI) / 180;
    const isSideways = angle === 90 || angle === 270;
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = isSideways ? img.height : img.width;
    rotCanvas.height = isSideways ? img.width : img.height;
    const rotCtx = rotCanvas.getContext('2d');

    rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rotCtx.rotate(rads);
    rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

    const cutoutDataUrl = processSignatureCutout(rotCanvas);
    setUploadedImage(cutoutDataUrl);
    onChange?.(cutoutDataUrl);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setRawImageObj(img);
        setRotationAngle(0);
        applyRotationAndCutout(img, 0);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRotate = (delta) => {
    if (!rawImageObj) return;
    const nextAngle = (rotationAngle + delta + 360) % 360;
    setRotationAngle(nextAngle);
    applyRotationAndCutout(rawImageObj, nextAngle);
  };

  const handleClear = () => {
    padRef.current?.clear();
    setUploadedImage(null);
    setRawImageObj(null);
    setRotationAngle(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onChange?.(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'draw' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('draw')}
        >
          <PenLine size={14} /> Draw Signature
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('upload')}
        >
          <Upload size={14} /> Upload Image
        </button>
      </div>

      {/* Signature area */}
      <div className="signature-pad-container">
        {mode === 'draw' && (
          <>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '200px' }} />
            <div className="signature-pad-toolbar">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                Draw your signature above using mouse, touchpad, or touchscreen
              </span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleClear}>
                <Trash2 size={14} /> Clear
              </button>
            </div>
          </>
        )}

        {mode === 'upload' && (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />

            {uploadedImage ? (
              <div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '150px'
                }}>
                  <img
                    src={uploadedImage}
                    alt="Uploaded Signature Cutout"
                    style={{ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain' }}
                  />
                </div>

                {/* Control toolbar: Rotation + Change + Remove */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleRotate(-90)}
                    title="Rotate 90° Counter-Clockwise"
                  >
                    <RotateCcw size={14} /> Rotate Left (↶)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleRotate(90)}
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw size={14} /> Rotate Right (↷)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={handleClear}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: 'rgba(79, 142, 247, 0.02)'
                }}
              >
                <ImageIcon size={36} color="var(--accent-blue)" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  Click to upload signature image
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Supports vertical/horizontal phone photos, scans, PNG, or JPG
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
