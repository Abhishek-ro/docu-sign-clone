// document-signature-app/my-app/app/dashboard/page.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import toast from "react-hot-toast"; // This import is correct

const PdfViewer = dynamic(() => import("../components/PdfViewer"), {
  ssr: false,
  loading: () => <p className="text-gray-600">Loading PDF viewer...</p>,
});

import SignaturePad from "../components/SignaturePad";

export default function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [viewedPdfUrl, setViewedPdfUrl] = useState(null);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [userSignature, setUserSignature] = useState(null);
  const [userDocuments, setUserDocuments] = useState([]);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState(null);
  const [shareEmail, setShareEmail] = useState("");

  const router = useRouter();

  // Function to fetch all documents for the logged-in user
  // Wrapped in useCallback to prevent unnecessary re-renders/issues with useEffect dependencies
  const fetchDocuments = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("Authentication token missing. Cannot fetch documents.");
      toast.error("You need to be logged in to view documents.");
      router.push("/login");
      return;
    }

    // Show loading toast
    toast.loading("Fetching documents...", { id: "fetchDocs" });

    try {
      const response = await fetch("http://localhost:5000/api/docs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("Response status:", token);
      if (response.ok) {
        const data = await response.json();
        setUserDocuments(data);
        console.log("Fetched user documents:", data);

        if (data.length > 0 && !viewedPdfUrl) {
          setViewedPdfUrl(`http://localhost:5000${data[0].filePath}`);
          setCurrentDocumentId(data[0]._id);
        }
        toast.success("Documents loaded successfully!", { id: "fetchDocs" });
      } else {
        // --- MODIFIED ERROR HANDLING BLOCK START ---
        let errorMessage = `Failed to load documents: Status ${response.status}.`;
        let errorData = null; // Initialize errorData

        // Check content-type to decide how to parse the response
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
            errorMessage = `Failed to load documents: ${
              errorData.message ||
              response.statusText ||
              `Status ${response.status}`
            }`;
          } catch (parseError) {
            console.log("Error parsing JSON error response:", parseError);
            errorMessage = `Failed to load documents: Server responded with invalid JSON. Status: ${response.status}.`;
          }
        } else {
          const errorText = await response.text();
          console.log(
            "Failed to fetch documents (non-JSON response):",
            errorText.substring(0, 200) + "..."
          );
          errorMessage = `Failed to load documents: Server responded with unexpected content (Status: ${response.status}). Please check backend server.`;
        }
        // --- MODIFIED ERROR HANDLING BLOCK END ---

        console.log(
          "Failed to fetch documents:",
          response.statusText,
          errorData || errorMessage
        );
        toast.error(errorMessage, { id: "fetchDocs" });

        if (response.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
        }
      }
    } catch (error) {
      console.log("Network error fetching documents:", error);
      toast.error(
        "A network error occurred while fetching documents. Is the backend server running?",
        {
          id: "fetchDocs",
        }
      );
    }
  }, [router, viewedPdfUrl]); // Added viewedPdfUrl to dependencies, and router for stability

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      fetchDocuments(); // Fetch documents when component mounts
    }
  }, [router, fetchDocuments]); // Added fetchDocuments to dependency array

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleSaveSignature = (signatureDataUrl) => {
    console.log(signatureDataUrl)
    setUserSignature(signatureDataUrl);
    setShowSignaturePad(false);
    toast.success("Signature saved successfully!");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first!");
      return;
    }

    toast.loading("Uploading file...", { id: "uploadFile" });

    const formData = new FormData();
    formData.append("document", selectedFile);

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication missing. Please log in again.", {
        id: "uploadFile",
      });
      router.push("/login");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/docs/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // --- MODIFIED ERROR HANDLING BLOCK START ---
      let data = {}; // Initialize data to an empty object
      let errorMessage = `Upload failed: Status ${response.status}.`;

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json(); // Attempt to parse as JSON
        } catch (parseError) {
          console.log("Error parsing JSON upload response:", parseError);
          errorMessage = `Upload failed: Server responded with invalid JSON. Status: ${response.status}.`;
        }
      } else {
        const errorText = await response.text();
        console.log(
          "Upload response was non-JSON:",
          errorText.substring(0, 200) + "..."
        );
        errorMessage = `Upload failed: Server responded with unexpected content (Status: ${response.status}). Please check backend server.`;
      }
      // --- MODIFIED ERROR HANDLING BLOCK END ---

      if (response.ok) {
        toast.success(`Document "${data.fileName}" uploaded successfully!`, {
          id: "uploadFile",
        });
        setSelectedFile(null);
        setViewedPdfUrl(`http://localhost:5000${data.filePath}`);
        setCurrentDocumentId(data.documentId);
        fetchDocuments(); // Refresh the document list after a successful upload
      } else {
        if (response.status === 401) {
          toast.error(
            `Unauthorized: ${data.message || "Please log in again."}`,
            { id: "uploadFile" }
          );
          localStorage.removeItem("token");
          router.push("/login");
        } else {
          // Use the parsed message if available, otherwise the generic one
          toast.error(
            data.message ? `Upload failed: ${data.message}` : errorMessage,
            {
              id: "uploadFile",
            }
          );
        }
      }
    } catch (err) {
      console.log("Upload error:", err);
      toast.error(
        "An unexpected network error occurred during upload. Is the backend server running?",
        {
          id: "uploadFile",
        }
      );
    }
  };

  const handleDeleteDocument = async (documentId, fileName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${fileName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.log("Authentication token missing. Cannot delete document.");
      toast.error("Authentication missing. Please log in again.");
      router.push("/login");
      return;
    }

    toast.loading(`Deleting "${fileName}"...`, { id: "deleteDoc" });
    try {
      const response = await fetch(
        `http://localhost:5000/api/docs/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        toast.success(`Document "${fileName}" deleted successfully.`, {
          id: "deleteDoc",
        });
        fetchDocuments(); // Refresh the document list
        // If the deleted document was the one currently viewed, clear the viewer
        if (currentDocumentId === documentId) {
          setViewedPdfUrl(null);
          setCurrentDocumentId(null);
        }
      } else {
        // --- MODIFIED ERROR HANDLING BLOCK START ---
        let errorMessage = `Failed to delete document: Status ${response.status}.`;
        let errorData = null; // Initialize errorData

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
            errorMessage = `Error deleting "${fileName}": ${
              errorData.message ||
              response.statusText ||
              `Status ${response.status}`
            }`;
          } catch (parseError) {
            console.log("Error parsing JSON delete response:", parseError);
            errorMessage = `Error deleting "${fileName}": Server responded with invalid JSON. Status: ${response.status}.`;
          }
        } else {
          const errorText = await response.text();
          console.log(
            "Delete response was non-JSON:",
            errorText.substring(0, 200) + "..."
          );
          errorMessage = `Error deleting "${fileName}": Server responded with unexpected content (Status: ${response.status}). Please check backend server.`;
        }
        // --- MODIFIED ERROR HANDLING BLOCK END ---

        console.log(
          "Failed to delete document:",
          errorData?.message || response.statusText || errorMessage
        );
        toast.error(errorMessage, { id: "deleteDoc" });
      }
    } catch (error) {
      console.log("Error deleting document:", error);
      toast.error(
        `An unexpected network error occurred while deleting "${fileName}". Is the backend server running?`,
        {
          id: "deleteDoc",
        }
      );
    }
  };

  // Function to handle viewing a document from the list
  const handleViewDocument = (document) => {
    setViewedPdfUrl(`http://localhost:5000${document.filePath}`);
    setCurrentDocumentId(document._id);
    toast("Viewing: " + document.fileName); // Inform user which document is being viewed
    setSelectedFile(null); // Clear selected file in upload form
  };

  // --- Start of Share Modal functions ---
  const handleShareClick = (doc) => {
    setDocumentToShare(doc);
    setIsShareModalOpen(true);
    setShareEmail(""); // Clear previous email
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareEmail || !documentToShare) {
      toast.error("Please enter an email and select a document to share.");
      return;
    }

    // Placeholder for actual sharing logic
    console.log(
      `Placeholder: Sharing document "${documentToShare.fileName}" with ${shareEmail}`
    );
    toast.success(
      `Document "${documentToShare.fileName}" shared with ${shareEmail} (placeholder for future feature!).`
    );

    setIsShareModalOpen(false);
    setDocumentToShare(null);
    setShareEmail("");
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setDocumentToShare(null);
    setShareEmail("");
  };
  // --- End of Share Modal functions ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-3xl font-extrabold text-purple-700">
          DocuSign Clone
        </h1>
        <nav>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              router.push("/login");
              toast.success("Logged out successfully!");
            }}
            className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 ease-in-out font-medium shadow-md"
          >
            Logout
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <div className="container mx-auto px-6 py-8">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-10">
          Your Dashboard
        </h2>

        <main className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Left Sidebar / Actions */}
          <div className="md:col-span-1 space-y-8">
            {/* Upload Document Card */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Upload New Document
              </h2>
              <p className="text-gray-600 mb-4">
                Select a PDF file to upload and prepare for signing.
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 cursor-pointer mb-4"
              />
              {selectedFile && (
                <p className="text-sm text-gray-700 mb-3">
                  Selected:{" "}
                  <span className="font-semibold">{selectedFile.name}</span>
                </p>
              )}
              <button
                onClick={handleUpload}
                disabled={!selectedFile}
                className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition duration-200 ease-in-out shadow-md
                                ${
                                  selectedFile
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-gray-400 cursor-not-allowed"
                                }`}
              >
                {selectedFile
                  ? `Upload "${selectedFile.name.substring(0, 20)}${
                      selectedFile.name.length > 20 ? "..." : ""
                    }"`
                  : "Select a PDF to Upload"}
              </button>
            </div>

            {/* Quick Actions / Signature Management */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Quick Actions
              </h2>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => setShowSignaturePad(true)}
                    className="flex items-center text-gray-700 hover:text-green-600 font-medium transition duration-150 w-full text-left"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      ></path>
                    </svg>
                    Create / Manage Signature
                  </button>
                  {userSignature && (
                    <div className="mt-3 p-2 border border-dashed border-gray-300 rounded-md bg-gray-50">
                      <p className="text-sm text-gray-600 mb-2">
                        Your Saved Signature:
                      </p>
                      <Image
                        src={userSignature}
                        alt="User Signature"
                        width={150}
                        height={60}
                        layout="intrinsic"
                        className="border border-gray-200 rounded"
                      />
                      <button
                        onClick={() => {
                          setUserSignature(null);
                          console.log("Signature cleared.");
                          toast("Signature cleared."); // <<<--- THIS IS THE CHANGED LINE
                        }}
                        className="mt-2 text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Clear Signature
                      </button>
                    </div>
                  )}
                </li>
              </ul>
            </div>
          </div>

          {/* Main Content: PDF Viewer */}
          <div className="md:col-span-2 bg-white p-4 rounded-lg shadow-md border-t-4 border-purple-500 flex flex-col items-center justify-center min-h-[600px]">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Document Viewer
            </h2>
            <PdfViewer
              fileUrl={viewedPdfUrl}
              documentId={currentDocumentId}
              userSignature={userSignature}
            />
          </div>

          {/* Right Sidebar / Document List */}
          <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-md border-t-4 border-teal-500">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Your Documents
            </h2>
            {userDocuments.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-md text-center text-gray-500 italic">
                <p className="mb-2">No documents uploaded yet.</p>
                <p>Upload your first PDF to get started!</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {userDocuments.map((doc) => (
                  <li
                    key={doc._id}
                    className="bg-gray-50 p-3 rounded-md shadow-sm hover:bg-gray-100 transition-colors duration-150"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <button
                        onClick={() => handleViewDocument(doc)}
                        className="flex-grow text-left pr-2"
                      >
                        <p className="font-medium text-gray-800 break-words">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded:{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {currentDocumentId === doc._id && (
                          <span className="text-blue-500 text-xs font-semibold mt-1 block">
                            Currently Viewing
                          </span>
                        )}
                      </button>
                      <div className="flex space-x-1">
                        {" "}
                        <button
                          onClick={() => handleShareClick(doc)}
                          className="p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                          title="Share Document"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8.684 13.342C8.882 13.064 9 12.732 9 12c0-.732-.118-1.064-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.516 4.654a3 3 0 000-9.308l-6.516 4.654m0 2.684V16.5a3 3 0 11-6 0v-9a3 3 0 116 0v2.584"
                            ></path>
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteDocument(doc._id, doc.fileName)
                          }
                          className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors"
                          title="Delete Document"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>

      {/* SignaturePad Modal */}
      {showSignaturePad && (
        <SignaturePad
          onSave={handleSaveSignature}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {/* Sharing Modal */}
      {isShareModalOpen && documentToShare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Share "{documentToShare.fileName}"
            </h2>
            <form onSubmit={handleShareSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="shareEmail"
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  Share with Email:
                </label>
                <input
                  type="email"
                  id="shareEmail"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Enter recipient's email"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeShareModal}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Share
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
