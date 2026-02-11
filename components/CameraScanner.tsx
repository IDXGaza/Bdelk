
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface CameraScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState(true);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsLoading(false);
    } catch (err) {
      setError('تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن وتحديث الصفحة.');
      setIsLoading(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [startCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Adjust canvas size to match video aspect ratio
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        
        // No mirroring logic here for the actual capture to keep text readable
        context.drawImage(videoRef.current, 0, 0);
        
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        onCapture(base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between text-right" dir="rtl">
      {/* Top Bar */}
      <div className="w-full p-6 flex justify-between items-center z-10">
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button 
          onClick={toggleCamera}
          className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16v12H4V4zm0 16h16v-2H4v2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v12" />
          </svg>
          <span className="mr-2 text-xs font-bold">تبديل</span>
        </button>
      </div>

      {/* Viewport Area */}
      <div className="relative flex-1 w-full max-w-md mx-auto overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 bg-black">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold">جاري تشغيل الكاميرا...</p>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-10 text-center text-white bg-black">
            <div className="space-y-4">
              <svg className="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-black text-lg">{error}</p>
              <button onClick={onClose} className="px-6 py-2 bg-white text-black rounded-xl font-bold">إغلاق</button>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* Scanning Overlay UI */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-64 h-64 relative">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
                
                {/* Moving scan line */}
                <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
              </div>
              <p className="mt-10 text-white font-bold text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">ضع المنتج داخل المربع</p>
            </div>
          </>
        )}
      </div>
      
      {/* Bottom Controls */}
      <div className="w-full p-10 flex items-center justify-center bg-gradient-to-t from-black to-transparent">
        <button 
          onClick={captureFrame}
          disabled={isLoading || !!error}
          className="group relative flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
        >
          {/* Inner ring */}
          <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full group-hover:scale-110 transition-transform"></div>
          </div>
          {/* Shimmer effect */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
        </button>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
      
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0.5; }
          50% { top: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default CameraScanner;
