// document-signature-app/my-app/app/components/SignaturePad.jsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

const SignaturePad = ({ onSave, onClose }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true); // Tracks if anything has been drawn on canvas
  const [error, setError] = useState("");
  const [uploadedSignature, setUploadedSignature] = useState(null); // Stores the data URL of the uploaded image
  const [mode, setMode] = useState("draw"); // 'draw' or 'upload'

  // Canvas drawing functions (remain mostly the same)
  const startDrawing = useCallback(
    (event) => {
      if (!canvasRef.current || mode !== "draw") return; // Only allow drawing in 'draw' mode
      setIsDrawing(true);
      setIsEmpty(false);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const { offsetX, offsetY } = getEventCoords(event, canvas);
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
    },
    [mode]
  );

  const draw = useCallback(
    (event) => {
      if (!isDrawing || !canvasRef.current || mode !== "draw") return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const { offsetX, offsetY } = getEventCoords(event, canvas);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    },
    [isDrawing, mode]
  );

  const stopDrawing = useCallback(() => {
    if (!canvasRef.current) return;
    setIsDrawing(false);
    setError("");
  }, []);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    setError("");
    setUploadedSignature(null); // Also clear uploaded signature if clearing canvas
  }, []);

  // New: Handle image file upload
  const handleImageUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (e.g., JPG, PNG).");
        setUploadedSignature(null);
        return;
      }
      setError(""); // Clear previous errors
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedSignature(reader.result); // Set the data URL
        setIsEmpty(false); // An image has been provided
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setUploadedSignature(null);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedSignature(null);
      setIsEmpty(true); // If file is deselected
    }
  }, []);

  // Modified: Save signature - now handles both drawn and uploaded
  const saveSignature = useCallback(() => {
    if (mode === "draw") {
      if (isEmpty) {
        setError("Please draw your signature before saving.");
        return;
      }
      // Get signature as a data URL (PNG format) from canvas
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onSave(dataUrl); // Pass the data URL to the parent component
    } else if (mode === "upload") {
      if (!uploadedSignature) {
        setError("Please upload your signature image before saving.");
        return;
      }
      onSave(uploadedSignature); // Pass the data URL of the uploaded image
    }
  }, [isEmpty, uploadedSignature, onSave, mode]);

  const getEventCoords = (event, canvas) => {
    const rect = canvas.getBoundingClientRect();
    if (event.touches) {
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top,
      };
    }
    return {
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    };
  };

  // Effect for canvas initialization (runs once on mount)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";

    const parentWidth = canvas.parentElement.clientWidth;
    canvas.width = parentWidth > 400 ? 400 : parentWidth - 20;
    canvas.height = 150;
  }, []);

  // Effect for setting up and cleaning up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only attach drawing listeners if in 'draw' mode
    if (mode === "draw") {
      canvas.addEventListener("mousedown", startDrawing);
      canvas.addEventListener("mousemove", draw);
      canvas.addEventListener("mouseup", stopDrawing);
      canvas.addEventListener("mouseleave", stopDrawing);

      canvas.addEventListener("touchstart", startDrawing);
      canvas.addEventListener("touchmove", draw);
      canvas.addEventListener("touchend", stopDrawing);
    }

    return () => {
      // Always remove listeners to prevent memory leaks, regardless of mode
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseleave", stopDrawing);

      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing, mode]); // Add mode as dependency

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">
          Add Your Signature
        </h2>
        {error && <p className="text-red-500 text-center mb-3">{error}</p>}

        {/* Mode Selection Buttons */}
        <div className="flex justify-center mb-4 space-x-2">
          <button
            onClick={() => {
              setMode("draw");
              clearCanvas();
            }} // Clear canvas when switching to draw
            className={`px-4 py-2 rounded-lg font-medium ${
              mode === "draw"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Draw Signature
          </button>
          <button
            onClick={() => {
              setMode("upload");
              clearCanvas();
            }} // Clear canvas/upload when switching to upload
            className={`px-4 py-2 rounded-lg font-medium ${
              mode === "upload"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Upload Signature
          </button>
        </div>

        {/* Conditional Rendering based on mode */}
        {mode === "draw" && (
          <div className="border border-gray-300 rounded-md overflow-hidden bg-gray-50 flex justify-center items-center relative">
            <canvas
              ref={canvasRef}
              className="touch-none"
              style={{ border: "1px solid #ccc", cursor: "crosshair" }}
            ></canvas>
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic pointer-events-none">
                Draw here
              </div>
            )}
          </div>
        )}

        {mode === "upload" && (
          <div className="flex flex-col items-center justify-center p-4 border border-gray-300 rounded-md bg-gray-50">
            <label
              htmlFor="signature-file-upload"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select your signature image (JPG, PNG)
            </label>
            <input
              id="signature-file-upload"
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 cursor-pointer"
            />
            {uploadedSignature && (
              <div className="mt-4 max-w-full max-h-40 overflow-hidden border border-gray-200 rounded-md flex justify-center items-center p-2">
                <img
                  src={uploadedSignature}
                  alt="Uploaded Signature"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            {!uploadedSignature && (
              <p className="text-gray-400 text-sm italic mt-2">
                No image selected
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between mt-4 space-x-2">
          {mode === "draw" && ( // Only show clear for draw mode
            <button
              onClick={clearCanvas}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors duration-200 ease-in-out font-medium flex-1"
            >
              Clear
            </button>
          )}
          {mode === "upload" && ( 
            <button
              onClick={() => {
                setUploadedSignature(null);
                setIsEmpty(true);
                setError("");
              }}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors duration-200 ease-in-out font-medium flex-1"
            >
              Clear Upload
            </button>
          )}

          <button
            onClick={saveSignature}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 ease-in-out font-medium flex-1"
          >
            Save Signature
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 ease-in-out font-medium flex-1"
          >
            Cancel
          </button>
        </div>
        <p className="text-sm text-gray-500 text-center mt-4">
          Your signature will be converted to an image.
        </p>
      </div>
    </div>
  );
};

export default SignaturePad;
