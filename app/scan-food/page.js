'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function ScanFoodPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoadingError, setModelLoadingError] = useState(null);
  const modelRef = useRef(null);

  // Fallback search & Food catalog matching
  const [allFoods, setAllFoods] = useState([]);
  const [matchedFood, setMatchedFood] = useState(null);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchFallback, setSearchFallback] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch campus food catalogue for confirmation matching
  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await fetch('/api/foods');
        if (res.ok) {
          const json = await res.json();
          setAllFoods(json.foods || []);
        }
      } catch (err) {
        console.error('Failed to load menu for camera matcher', err);
      }
    }
    fetchMenu();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Lazy-load MobileNet model
  const loadModel = async () => {
    if (modelRef.current) return modelRef.current;
    try {
      const mobilenet = await import('@tensorflow-models/mobilenet');
      const loaded = await mobilenet.load({ version: 2, alpha: 1.0 });
      modelRef.current = loaded;
      setModelLoaded(true);
      return loaded;
    } catch (err) {
      console.error('Failed to load MobileNet model', err);
      setModelLoadingError('Vision classifier unavailable. Manual food selection is active.');
      return null;
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      loadModel();
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or device has no camera. Please grant browser camera permissions or use manual search fallback.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(dataUrl);
    stopCamera();

    setIsAnalyzing(true);
    try {
      const model = await loadModel();
      if (model) {
        const results = await model.classify(canvas);
        setPredictions(results || []);

        if (results && results.length > 0) {
          matchClassToMenu(results[0].className);
        }
      }
    } catch (err) {
      console.error('Inference error:', err);
      showToast('Vision recognition error. Please select food manually.', 'warning');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Keyword mapping from generic ImageNet classes to campus menu
  const matchClassToMenu = (className) => {
    const lower = className.toLowerCase();
    
    let matched = null;
    if (lower.includes('coffee') || lower.includes('espresso')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('coffee'));
    } else if (lower.includes('tea') || lower.includes('cup')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('tea'));
    } else if (lower.includes('sandwich') || lower.includes('burger')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('burger') || f.food_name.toLowerCase().includes('sandwich'));
    } else if (lower.includes('pizza') || lower.includes('pasta')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('pasta'));
    } else if (lower.includes('rice') || lower.includes('plate') || lower.includes('wok')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('fried rice') || f.food_name.toLowerCase().includes('meals'));
    } else if (lower.includes('banana') || lower.includes('orange') || lower.includes('apple') || lower.includes('fruit')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('fruits') || f.food_name.toLowerCase().includes('juice'));
    } else if (lower.includes('noodle') || lower.includes('spaghetti')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('noodles'));
    } else if (lower.includes('bagel') || lower.includes('bread') || lower.includes('bakery')) {
      matched = allFoods.find(f => f.food_name.toLowerCase().includes('puff') || f.food_name.toLowerCase().includes('samosa'));
    }

    if (matched) {
      setMatchedFood(matched);
      setSelectedCanteen(matched.canteen);
    }
  };

  const handleConfirmLog = async () => {
    if (!matchedFood) {
      showToast('Please select a food item to confirm', 'warning');
      return;
    }
    setIsLogging(true);
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_db_id: matchedFood.id,
          quantity: Number(quantity),
          logged_at: new Date().toISOString(),
          source: 'camera_confirmed',
        }),
      });

      if (!res.ok) throw new Error('Failed to log');
      showToast(`Logged ${quantity}x ${matchedFood.food_name} via Camera Confirmation!`, 'success');
      setCapturedImage(null);
      setPredictions([]);
      setMatchedFood(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLogging(false);
    }
  };

  const filteredFallbackFoods = searchFallback
    ? allFoods.filter(f => f.food_name.toLowerCase().includes(searchFallback.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div>
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Webcam Food Recognition</h1>
          <p className="page-subtitle">
            Capture a still frame of your meal with your browser camera, review neural vision classifications, and confirm against verified catalogue items.
          </p>
        </div>
        <div>
          <Link href="/log-food" className="btn btn-secondary">
            Manual Food Logger
          </Link>
        </div>
      </div>

      {/* Mandatory Accuracy Disclaimer (Spec Item 136) */}
      <div className="editorial-callout" style={{ borderLeftColor: 'var(--accent-amber)' }}>
        <div className="editorial-callout-title" style={{ color: 'var(--accent-amber)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Neural Vision & Nutrition Scope Notice
        </div>
        <div className="editorial-callout-text">
          Camera recognition classifies candidate food categories from pixels, but <em>cannot infer portion size, oil absorption, cooking recipes, or exact calories</em>. Nutrition facts are strictly retrieved from our verified campus catalogue after your manual confirmation.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '28px' }}>
        
        {/* Camera Viewport & Controls */}
        <div className="card">
          <div className="card-header">
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Camera Viewport</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isCameraActive ? (
                <button onClick={startCamera} className="btn btn-sm btn-primary">
                  Start Camera
                </button>
              ) : (
                <button onClick={stopCamera} className="btn btn-sm btn-secondary">
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          {cameraError && (
            <div style={{ padding: '12px 14px', background: 'var(--accent-rose-tint)', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', color: 'var(--accent-rose)', fontSize: '13px', marginBottom: '16px' }}>
              {cameraError}
            </div>
          )}

          {/* Viewport Frame */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '320px',
            background: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-default)',
            marginBottom: '16px'
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: isCameraActive ? 'block' : 'none'
              }}
            />

            {capturedImage && !isCameraActive && (
              <img
                src={capturedImage}
                alt="Captured meal"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {!isCameraActive && !capturedImage && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Camera stream is offline</div>
                <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Click below to grant permission and initiate camera.</div>
                <button onClick={startCamera} className="btn btn-sm btn-primary" style={{ marginTop: '12px' }}>
                  Enable Camera
                </button>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Capture Trigger */}
          {isCameraActive && (
            <button
              onClick={capturePhoto}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Capture Still Photo
            </button>
          )}

          {capturedImage && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setCapturedImage(null);
                  setPredictions([]);
                  setMatchedFood(null);
                  startCamera();
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Prediction Results & Confirmation Workflow */}
        <div className="card">
          <div className="card-header">
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Prediction & Catalogue Match</h2>
            <span className="badge badge-blue">MobileNet v2</span>
          </div>

          {isAnalyzing && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <span>Running neural vision inference...</span>
            </div>
          )}

          {/* Predictions Display */}
          {predictions.length > 0 && !isAnalyzing && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>
                Vision Classifier Predictions:
              </div>
              {predictions.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: idx === 0 ? 'var(--accent-primary-tint)' : 'var(--bg-canvas)',
                    border: idx === 0 ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    marginBottom: '6px',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {p.className}
                  </span>
                  <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                    {Math.round(p.probability * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Matched / Selected Catalogue Food */}
          {matchedFood ? (
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--bg-canvas)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <span className="badge badge-emerald" style={{ marginBottom: '4px' }}>
                    Matched Catalogue Item
                  </span>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {matchedFood.food_name}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {matchedFood.canteen} &bull; {matchedFood.category}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    ₹{matchedFood.price_inr * quantity}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    (₹{matchedFood.price_inr} / serving)
                  </div>
                </div>
              </div>

              {/* Nutrition Snapshot */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
                <div style={{ background: '#ffffff', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CALORIES</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {matchedFood.calories_kcal ? `${Math.round(matchedFood.calories_kcal * quantity)} kcal` : 'Pending'}
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PROTEIN</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    {matchedFood.protein_g ? `${Math.round(matchedFood.protein_g * quantity)} g` : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Servings:</span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  -
                </button>
                <span style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </button>
              </div>

              {/* Explicit Confirmation Button */}
              <button
                onClick={handleConfirmLog}
                disabled={isLogging}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                {isLogging ? 'Confirming...' : 'Explicitly Confirm & Log to Profile'}
              </button>
            </div>
          ) : (
            !isAnalyzing && (
              <div style={{ padding: '20px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>
                Capture a photo or use manual search below to select your meal.
              </div>
            )
          )}

          {/* Manual Search Fallback (Spec requirement 130) */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <label className="form-label">
              Manual Search Fallback:
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Search campus dish name directly..."
              value={searchFallback}
              onChange={(e) => setSearchFallback(e.target.value)}
            />

            {filteredFallbackFoods.length > 0 && (
              <div style={{ marginTop: '8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', maxHeight: '180px', overflowY: 'auto', background: '#ffffff' }}>
                {filteredFallbackFoods.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => {
                      setMatchedFood(f);
                      setSelectedCanteen(f.canteen);
                      setSearchFallback('');
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}
                  >
                    <span>{f.food_name} ({f.canteen})</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>₹{f.price_inr}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
