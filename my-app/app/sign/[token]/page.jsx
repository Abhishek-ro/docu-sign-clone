// document-signature-app/my-app/app/sign/[token]/page.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import axios from "axios";

// Dynamically import PdfViewer with SSR disabled
const PdfViewer = dynamic(() => import("../../../components/PdfViewer"), {
  ssr: false,
  loading: () => <p className="text-gray-600">Loading document...</p>,
});

// We'll need a way for the public user to draw their signature
// For simplicity, we can reuse SignaturePad or embed it directly here.
// For now, let's assume SignaturePad is available.
import SignaturePad from "../../../components/SignaturePad"; // Adjust path if necessary

export default function PublicSignPage() {
  const params = useParams();
  const token = params.token; // Get the token from the URL
  const [documentData, setDocumentData] = useState(null);
  const [viewedPdfUrl, setViewedPdfUrl] = useState(null);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [userSignature, setUserSignature] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to fetch document details using the share token
  const fetchDocumentByToken = useCallback(async () => {
    if (!token) {
      setError("No share token provided.");
      setIsLoading(false);
      toast.error("Invalid link: No token found.");
      return;
    }

    setIsLoading(true);
    setError(null);
    toast.loading("Loading document for signing...", { id: "loadPublicDoc" });

    try {
      // NEW BACKEND ENDPOINT NEEDED: This will be a public endpoint
      // that takes a token and returns document details.
      // We will create this public endpoint in the next step on the backend.
      const response = await axios.get(
        `http://localhost:5000/public/documents/${token}`
      );

      const doc = response.data;

      // Basic validation of the document data
      if (!doc || !doc.filePath || !doc._id) {
        throw new Error("Invalid document data received.");
      }

      setDocumentData(doc);
      setViewedPdfUrl(`http://localhost:5000${doc.filePath}`);
      setCurrentDocumentId(doc._id);
      toast.success("Document loaded! Please sign.", { id: "loadPublicDoc" });
    } catch (err) {
      console.log(
        "Error fetching document by token:",
        err.response?.data || err.message
      );
      setError(
        err.response?.data?.message ||
          "Failed to load document. The link might be invalid or expired."
      );
      toast.error(err.response?.data?.message || "Failed to load document.", {
        id: "loadPublicDoc",
      });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDocumentByToken();
  }, [fetchDocumentByToken]);

  const handleSaveSignature = (signatureDataUrl) => {
    setUserSignature(signatureDataUrl);
    setShowSignaturePad(false);
    toast.success("Signature saved locally. Now place it on the document!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50">
        <h1 className="text-2xl font-bold text-red-700 mb-4">Error</h1>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">
          Document not found or invalid link.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 text-gray-800 p-4">
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-20 mb-4 rounded-lg">
        <h1 className="text-3xl font-extrabold text-blue-700">Sign Document</h1>
        <button
          onClick={() => setShowSignaturePad(true)}
          className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 ease-in-out font-medium shadow-md"
        >
          {userSignature ? "Change Signature" : "Create Signature"}
        </button>
      </header>

      <main className="container mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">
          Document: {documentData.fileName}
        </h2>

        <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-blue-500 flex flex-col items-center justify-center min-h-[600px]">
          <PdfViewer
            fileUrl={viewedPdfUrl}
            documentId={currentDocumentId}
            userSignature={userSignature}
            // Add a callback here for when the document is finalized by the public signer
            // This will be implemented later, possibly a POST to /public/documents/:token/sign
          />
        </div>
      </main>

      {showSignaturePad && (
        <SignaturePad
          onSave={handleSaveSignature}
          onClose={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  );
}
