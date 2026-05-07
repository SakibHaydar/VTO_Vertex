'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
    FiUpload,
    FiCamera,
    FiRefreshCw,
    FiDownload,
    FiMaximize2,
    FiMinimize2,
    FiX,
    FiLink,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
    });

export default function VTOStudio() {
    // ── Garment state ──────────────────────────────────
    const [garmentImage, setGarmentImage] = useState(null); // { dataUrl, mimeType }
    const [garmentUrl, setGarmentUrl] = useState('');
    const [garmentTab, setGarmentTab] = useState('upload'); // 'upload' | 'url'
    const [isGarmentExpanded, setIsGarmentExpanded] = useState(false);

    // ── Person state ───────────────────────────────────
    const [personImage, setPersonImage] = useState(null); // { dataUrl, mimeType }
    const [personTab, setPersonTab] = useState('upload'); // 'upload' | 'camera'
    const [cameraActive, setCameraActive] = useState(false);

    // ── Result state ───────────────────────────────────
    const [processedImage, setProcessedImage] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const garmentFileRef = useRef(null);
    const personFileRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
    }, []);

    // ── Garment handlers ───────────────────────────────
    const handleGarmentUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
        const dataUrl = await fileToBase64(file);
        setGarmentImage({ dataUrl, mimeType: file.type || 'image/jpeg' });
        setProcessedImage(null);
        e.target.value = '';
    };

    // ── Person handlers ────────────────────────────────
    const handlePersonUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
        const dataUrl = await fileToBase64(file);
        setPersonImage({ dataUrl, mimeType: file.type || 'image/jpeg' });
        setProcessedImage(null);
        e.target.value = '';
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            setCameraActive(true);
        } catch {
            toast.error('Camera access denied');
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setCameraActive(false);
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPersonImage({ dataUrl, mimeType: 'image/jpeg' });
        setProcessedImage(null);
        stopCamera();
        setPersonTab('upload');
    };

    // ── VTO generation ─────────────────────────────────
    const hasGarment = garmentImage || garmentUrl.trim();
    const canGenerate = !!hasGarment && !!personImage && !processing;

    const handleTryOn = async () => {
        if (!canGenerate) return;
        setProcessing(true);
        try {
            const body = { personImage: personImage.dataUrl };
            if (garmentUrl.trim()) {
                body.clothingImageUrl = garmentUrl.trim();
            } else {
                body.clothingImage = garmentImage.dataUrl;
            }

            const res = await fetch('/api/vertex-vto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (data.success && data.result) {
                setProcessedImage(data.result);
                toast.success('Your look is ready!');
            } else {
                throw new Error(data.error || 'Failed to generate image');
            }
        } catch (err) {
            console.error('VTO Error:', err);
            toast.error(err.message || 'Something went wrong');
        } finally {
            setProcessing(false);
        }
    };

    // ── Render ─────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <style>{`
                @keyframes teal-shift {
                    0%   { background-position: 0% 50%; }
                    50%  { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>

            {/* ── Header ── */}
            <header className="bg-white border-b border-gray-200 shadow-sm shrink-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#32BBAB] to-[#0d9488] rounded-xl flex items-center justify-center shadow-md">
                            <HiSparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-gray-900 leading-none">VTO Vertex</h1>
                            <p className="text-[11px] text-gray-400 mt-0.5">Virtual Try-On Studio · Powered by Google Vertex AI</p>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#32BBAB] animate-pulse" />
                        <span className="text-[11px] font-semibold text-gray-500">AI Ready</span>
                    </div>
                </div>
            </header>

            {/* ── Instructions bar ── */}
            <div className="bg-white border-b border-gray-100 shrink-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-6 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#32BBAB] text-white text-[9px] font-black flex items-center justify-center">1</span>
                        Upload garment
                    </span>
                    <span className="text-gray-200">→</span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-gray-300 text-white text-[9px] font-black flex items-center justify-center">2</span>
                        Upload your portrait
                    </span>
                    <span className="text-gray-200">→</span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-gray-300 text-white text-[9px] font-black flex items-center justify-center">3</span>
                        Generate &amp; save
                    </span>
                </div>
            </div>

            {/* ── Main 3-Column Grid ── */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start h-full">

                    {/* ═══════════════════════════════════════
                        COLUMN 1 — GARMENT
                    ═══════════════════════════════════════ */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

                        {/* Card Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center transition-colors ${hasGarment ? 'bg-[#32BBAB]' : 'bg-gray-300'}`}>
                                    1
                                </span>
                                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Garment</span>
                            </div>
                            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                                <button
                                    onClick={() => setGarmentTab('upload')}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all
                                        ${garmentTab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Upload
                                </button>
                                <button
                                    onClick={() => setGarmentTab('url')}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all
                                        ${garmentTab === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    URL
                                </button>
                            </div>
                        </div>

                        {/* Garment Image Area */}
                        <div className="relative bg-gray-50 group" style={{ height: '300px' }}>
                            {garmentImage ? (
                                <>
                                    <Image
                                        src={garmentImage.dataUrl}
                                        alt="Garment"
                                        fill
                                        className="object-contain p-4"
                                    />
                                    <button
                                        onClick={() => { setGarmentImage(null); setProcessedImage(null); }}
                                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm text-gray-500 rounded-lg flex items-center justify-center border border-gray-200 shadow-sm hover:text-red-500 transition-colors z-10"
                                    >
                                        <FiX className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setIsGarmentExpanded(true)}
                                        className="absolute bottom-3 right-3 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-gray-200 shadow-sm text-gray-500 hover:text-[#32BBAB] transition-all opacity-0 group-hover:opacity-100 z-10"
                                    >
                                        <FiMaximize2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            ) : garmentTab === 'url' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-3 text-center">
                                    <FiLink className="w-8 h-8 text-gray-200" />
                                    <p className="text-xs text-gray-400">Paste a clothing image URL below</p>
                                    {garmentUrl && (
                                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={garmentUrl} alt="URL preview" className="w-full h-full object-cover" onError={() => {}} />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    onClick={() => garmentFileRef.current?.click()}
                                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-[#32BBAB]/5 transition-all p-8 text-center"
                                >
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-200">
                                        <FiUpload className="w-7 h-7 text-[#32BBAB]" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700">Upload Garment Photo</p>
                                    <p className="text-xs text-gray-400 mt-1">JPG, PNG — up to 10MB</p>
                                    <p className="text-[10px] text-gray-300 mt-3">Use a clean product image on white/neutral background</p>
                                    <input
                                        type="file"
                                        ref={garmentFileRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleGarmentUpload}
                                    />
                                </div>
                            )}
                        </div>

                        {/* URL input (shown only in URL tab) */}
                        {garmentTab === 'url' && (
                            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                                <input
                                    type="url"
                                    value={garmentUrl}
                                    onChange={(e) => { setGarmentUrl(e.target.value); setProcessedImage(null); }}
                                    placeholder="https://example.com/shirt.jpg"
                                    className="w-full text-sm border-2 border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#32BBAB] transition-colors placeholder-gray-300"
                                />
                            </div>
                        )}

                        {/* Tips */}
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mb-1.5">Tips for best results</p>
                            <ul className="text-[10px] text-gray-400 space-y-0.5 list-disc list-inside">
                                <li>Use front-facing product shots</li>
                                <li>White or neutral background works best</li>
                                <li>Single garment per image</li>
                            </ul>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════
                        COLUMN 2 — PORTRAIT
                    ═══════════════════════════════════════ */}
                    <div
                        className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden sticky top-4"
                        style={{ height: 'calc(100vh - 145px)' }}
                    >
                        {/* Card Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center transition-colors ${personImage ? 'bg-[#32BBAB]' : 'bg-gray-300'}`}>
                                    2
                                </span>
                                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Your Portrait</span>
                            </div>
                            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                                <button
                                    onClick={() => { setPersonTab('upload'); stopCamera(); }}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all
                                        ${personTab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Upload
                                </button>
                                <button
                                    onClick={() => { setPersonTab('camera'); startCamera(); }}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all
                                        ${personTab === 'camera' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Camera
                                </button>
                            </div>
                        </div>

                        {/* Portrait Area */}
                        <div className="relative bg-gray-50 flex-1 min-h-0">
                            {personImage ? (
                                <>
                                    <Image
                                        src={personImage.dataUrl}
                                        alt="Your portrait"
                                        fill
                                        className="object-contain p-3"
                                    />
                                    <button
                                        onClick={() => { setPersonImage(null); setProcessedImage(null); }}
                                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm text-gray-500 rounded-lg flex items-center justify-center border border-gray-200 shadow-sm hover:text-red-500 transition-colors z-10"
                                    >
                                        <FiX className="w-4 h-4" />
                                    </button>
                                </>
                            ) : personTab === 'camera' && cameraActive ? (
                                <div className="w-full h-full bg-gray-900">
                                    <video
                                        ref={(el) => {
                                            videoRef.current = el;
                                            if (el && streamRef.current) {
                                                el.srcObject = streamRef.current;
                                                el.play().catch(() => { });
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div
                                    onClick={() => personFileRef.current?.click()}
                                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-[#32BBAB]/5 transition-all p-8 text-center"
                                >
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-200">
                                        <FiUpload className="w-7 h-7 text-[#32BBAB]" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700">Upload Your Photo</p>
                                    <p className="text-xs text-gray-400 mt-1">JPG, PNG — up to 5MB</p>
                                    <p className="text-[10px] text-gray-300 mt-3">Full-body photo works best · Neutral background</p>
                                    <input
                                        type="file"
                                        ref={personFileRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handlePersonUpload}
                                    />
                                </div>
                            )}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Footer — Capture or Generate */}
                        <div className="p-3 border-t border-gray-100 shrink-0">
                            {personTab === 'camera' && cameraActive ? (
                                <button
                                    onClick={capturePhoto}
                                    className="w-full py-3.5 rounded-xl font-bold text-sm uppercase flex items-center justify-center gap-3 bg-[#32BBAB] hover:bg-[#2a9d8f] text-white shadow-lg active:scale-95 transition-all"
                                >
                                    <FiCamera className="w-5 h-5" />
                                    Capture Photo
                                </button>
                            ) : (
                                <button
                                    onClick={handleTryOn}
                                    disabled={!canGenerate}
                                    className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase flex items-center justify-center gap-2 transition-all
                                        ${!canGenerate
                                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                            : 'hover:-translate-y-0.5 active:translate-y-0'
                                        }`}
                                    style={canGenerate ? {
                                        background: 'linear-gradient(270deg, #0d9488, #14b8a6, #2dd4bf, #32BBAB, #06b6d4, #0891b2, #22d3ee, #5eead4, #0d9488)',
                                        backgroundSize: '400% 400%',
                                        animation: 'teal-shift 4s ease infinite',
                                        color: '#ffffff',
                                        boxShadow: '0 10px 30px -5px rgba(50,187,171,0.35)',
                                    } : {}}
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <HiSparkles className="w-5 h-5" />
                                            <span>Generate Look</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════
                        COLUMN 3 — RESULT
                    ═══════════════════════════════════════ */}
                    <div
                        className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden sticky top-4"
                        style={{ height: 'calc(100vh - 145px)' }}
                    >
                        {/* Card Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center transition-colors ${processedImage ? 'bg-[#32BBAB]' : 'bg-gray-300'}`}>
                                    3
                                </span>
                                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Result</span>
                            </div>
                            {processedImage && (
                                <button
                                    onClick={() => setProcessedImage(null)}
                                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all border border-gray-200"
                                    title="Reset result"
                                >
                                    <FiRefreshCw className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Result Canvas */}
                        <div className="relative bg-gray-50 flex-1 min-h-0">
                            {processedImage ? (
                                <Image
                                    src={processedImage}
                                    alt="VTO Result"
                                    fill
                                    className="object-contain p-3"
                                    priority
                                />
                            ) : processing ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                                    <div className="relative w-16 h-16 mb-5">
                                        <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
                                        <div className="absolute inset-0 border-4 border-[#32BBAB] rounded-full border-t-transparent animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <HiSparkles className="w-6 h-6 text-[#32BBAB] animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-gray-700 animate-pulse">AI is rendering your look...</p>
                                    <p className="text-xs text-gray-400 mt-1">This may take 10–30 seconds</p>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center opacity-40">
                                    <HiSparkles className="w-12 h-12 text-gray-300 mb-3" />
                                    <p className="text-sm font-bold text-gray-400">Your look will appear here</p>
                                    <p className="text-xs text-gray-300 mt-1">Upload garment &amp; portrait, then click Generate</p>
                                </div>
                            )}
                        </div>

                        {/* Download / Zoom — only when result exists */}
                        {processedImage && (
                            <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
                                <button
                                    onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = processedImage;
                                        a.download = 'vto-vertex-result.jpg';
                                        a.click();
                                    }}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <FiDownload className="w-3.5 h-3.5" />
                                    Save
                                </button>
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <FiMaximize2 className="w-3.5 h-3.5" />
                                    Zoom
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* ── Garment Fullscreen Overlay ── */}
            <AnimatePresence>
                {isGarmentExpanded && garmentImage && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setIsGarmentExpanded(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="relative w-full max-w-2xl max-h-[90vh] aspect-[3/4]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image src={garmentImage.dataUrl} alt="Garment" fill className="object-contain rounded-2xl" />
                            <button
                                onClick={() => setIsGarmentExpanded(false)}
                                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                            >
                                <FiMinimize2 className="w-5 h-5" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Result Fullscreen Overlay ── */}
            <AnimatePresence>
                {isExpanded && processedImage && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setIsExpanded(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="relative w-full max-w-2xl max-h-[90vh] aspect-[3/4]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image src={processedImage} alt="VTO Result Fullscreen" fill className="object-contain rounded-2xl" />
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                            >
                                <FiMinimize2 className="w-5 h-5" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
