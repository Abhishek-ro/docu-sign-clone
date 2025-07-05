"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "react-hot-toast";
import { useDroppable } from "@dnd-kit/core";

// Set up the PDF.js worker source
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

export default function PdfViewer({
  fileUrl,
  documentId,
  userSignature,
  onFinalizeSuccess,
  onDropAnnotation,
  currentPageAnnotations,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const pageContainerRef = useRef(null);
  const [annotationMode, setAnnotationMode] = useState("view");
  const [allAnnotations, setAllAnnotations] = useState([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [displayPdfUrl, setDisplayPdfUrl] = useState(fileUrl);
  const fabricRef = useRef(null);

  console.log("PdfViewer Component Rendered");
  console.log("Current fileUrl:", fileUrl);
  console.log("Current documentId:", documentId);
  console.log("User Signature (first 30 chars):", userSignature ? userSignature.substring(0, 30) + "..." : "N/A");
  console.log("Current annotationMode:", annotationMode);
  console.log("Current pageNumber:", pageNumber);
  console.log("Total annotations loaded:", allAnnotations.length);
  console.log("Display PDF URL:", displayPdfUrl);


  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `pdf-page-droppable-${pageNumber}`,
  });

  const combineRefs = useCallback(
    (node) => {
      pageContainerRef.current = node;
      setDroppableNodeRef(node);
      console.log("combineRefs: Page container ref updated.");
    },
    [setDroppableNodeRef]
  );

  useEffect(() => {
    console.log("useEffect: Fabric.js import initiated.");
    if (typeof window !== "undefined") {
      import("fabric")
        .then((mod) => {
          fabricRef.current = mod.fabric;
          console.log("useEffect: Fabric.js loaded successfully.");
        })
        .catch((error) => {
          console.error("useEffect: Failed to load Fabric.js:", error);
          toast.error("Failed to load annotation tools. Please refresh.");
        });
    }
  }, []); // Runs only once on component mount

  const fetchAnnotations = useCallback(async () => {
    console.log("fetchAnnotations: Attempting to fetch annotations for documentId:", documentId);
    if (!documentId) {
      setAllAnnotations([]);
      console.log("fetchAnnotations: No documentId, skipping fetch.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("fetchAnnotations: Authentication token missing. Cannot fetch annotations.");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/docs/${documentId}/annotations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAllAnnotations(data);
        console.log("fetchAnnotations: Successfully fetched annotations:", data.length, "items.");
      } else {
        console.error("fetchAnnotations: Failed to fetch annotations:", response.status, response.statusText);
        setAllAnnotations([]);
      }
    } catch (error) {
      console.error("fetchAnnotations: Error fetching annotations:", error);
      setAllAnnotations([]);
    }
  }, [documentId]); // Re-runs if documentId changes

  const saveAnnotations = useCallback(
    async (currentAnnotations) => {
      console.log("saveAnnotations: Attempting to save annotations for documentId:", documentId, " Annotations count:", currentAnnotations.length);
      if (!documentId) {
        console.log("saveAnnotations: No documentId, skipping save.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("saveAnnotations: Authentication token missing. Cannot save annotations.");
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:5000/api/docs/${documentId}/annotations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ annotations: currentAnnotations }),
          }
        );
        if (response.ok) {
          console.log("saveAnnotations: Annotations saved successfully.");
        } else {
          console.error("saveAnnotations: Failed to save annotations:", response.status, response.statusText);
        }
      } catch (error) {
        console.error("saveAnnotations: Error saving annotations:", error);
      }
    },
    [documentId] // Re-runs if documentId changes
  );

  const handleFinalizeDocument = useCallback(async () => {
    console.log("handleFinalizeDocument: Initiated finalization process.");
    if (!documentId || isFinalizing) {
        console.log("handleFinalizeDocument: Skipping finalization - No documentId or already finalizing.");
        return;
    }

    const finalizeToastId = toast.loading("Finalizing document...");
    setIsFinalizing(true);
    console.log("handleFinalizeDocument: isFinalizing set to true.");

    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("handleFinalizeDocument: Authentication token missing. Cannot finalize document.");
      toast.error("Authentication required. Please log in.", {
        id: finalizeToastId,
      });
      setIsFinalizing(false);
      return;
    }

    console.log("handleFinalizeDocument: Saving current annotations before finalization.");
    await saveAnnotations(allAnnotations);

    try {
      const response = await fetch(
        `http://localhost:5000/api/docs/${documentId}/finalize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("handleFinalizeDocument: Document finalized successfully. Finalized URL:", data.finalizedUrl);
        toast.success(
          "Document finalized successfully! Loading finalized version.",
          { id: finalizeToastId }
        );

        setDisplayPdfUrl(data.finalizedUrl);
        setAnnotationMode("view");
        console.log("handleFinalizeDocument: Annotation mode set to 'view', Fabric canvas being cleared/disposed.");
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.clear();
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }
        setAllAnnotations([]);
        console.log("handleFinalizeDocument: All annotations cleared.");

        if (onFinalizeSuccess) {
          onFinalizeSuccess(documentId, data.finalizedUrl);
          console.log("handleFinalizeDocument: onFinalizeSuccess callback triggered.");
        }
      } else {
        const errorData = await response.json();
        console.error(
          "handleFinalizeDocument: Failed to finalize document:",
          errorData.message || response.statusText
        );
        toast.error(
          `Failed to finalize document: ${
            errorData.message || "Server error."
          }`,
          { id: finalizeToastId }
        );
      }
    } catch (error) {
      console.error("handleFinalizeDocument: Error finalizing document:", error);
      toast.error("An error occurred during finalization. Please try again.", {
        id: finalizeToastId,
      });
    } finally {
      setIsFinalizing(false);
      console.log("handleFinalizeDocument: isFinalizing set to false.");
    }
  }, [
    documentId,
    isFinalizing,
    allAnnotations,
    saveAnnotations,
    onFinalizeSuccess,
  ]);

  const initializeFabricCanvas = useCallback(() => {
    console.log("initializeFabricCanvas: Function started.");
    if (!pageContainerRef.current || !fabricRef.current) {
      console.log("initializeFabricCanvas: Missing pageContainerRef or fabricRef.current. Exiting.");
      return;
    }

    const pdfPage = pageContainerRef.current.querySelector(".react-pdf__Page");
    if (!pdfPage) {
      console.log("initializeFabricCanvas: No .react-pdf__Page found. Exiting.");
      return;
    }

    const { clientWidth, clientHeight } = pdfPage;
    console.log(`initializeFabricCanvas: PDF Page dimensions - Width: ${clientWidth}, Height: ${clientHeight}`);


    if (displayPdfUrl && displayPdfUrl.includes("finalized_")) {
      console.log("initializeFabricCanvas: PDF is finalized. Disposing Fabric canvas.");
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      return;
    }

    if (fabricCanvasRef.current) {
      console.log("initializeFabricCanvas: Existing Fabric canvas found, disposing it.");
      fabricCanvasRef.current.dispose();
    }

    const canvas = new fabricRef.current.Canvas(canvasRef.current, {
      width: clientWidth,
      height: clientHeight,
      selection: true,
      hoverCursor: "default",
    });
    fabricCanvasRef.current = canvas;
    console.log("initializeFabricCanvas: New Fabric.js canvas initialized.");

    if (fabricRef.current.Object && fabricRef.current.util) {
      fabricRef.current.Object.prototype.toObject = (function (toObject) {
        return function () {
          return fabricRef.current.util.object.extend(toObject.call(this), {
            id: this.id,
            name: this.name,
            text: this.text,
            imageData: this.imageData,
          });
        };
      })(fabricRef.current.Object.prototype.toObject);
      console.log("initializeFabricCanvas: Fabric.js Object prototype modified for custom properties.");
    } else {
      console.warn(
        "initializeFabricCanvas: Fabric.js Object or util not available for prototype modification."
      );
    }

    const pageAnnotationsToRender =
      currentPageAnnotations ||
      allAnnotations.filter((ann) => ann.page === pageNumber);
    console.log(`initializeFabricCanvas: Found ${pageAnnotationsToRender.length} annotations to render for page ${pageNumber}.`);

    pageAnnotationsToRender.forEach((ann) => {
      if (ann.type === "placed_signature" && ann.imageData) {
        console.log(`initializeFabricCanvas: Rendering existing placed_signature (ID: ${ann.id})`);
        fabricRef.current.Image.fromURL(
          ann.imageData,
          function (img) {
            img.set({
              left: ann.x,
              top: ann.y,
              scaleX: ann.width / img.width,
              scaleY: ann.height / img.height,
              selectable: true,
              hasControls: true,
              name: "placed_signature",
              id: ann.id,
              originX: "left",
              originY: "top",
              imageData: ann.imageData,
            });
            canvas.add(img);
            canvas.renderAll();
            console.log(`initializeFabricCanvas: Added existing signature (ID: ${ann.id}) to canvas.`);
          },
          {
            crossOrigin: "anonymous",
            onError: (err) => {
              console.error(
                `initializeFabricCanvas: Fabric.js Image loading failed for existing signature (ID: ${ann.id}):`,
                err
              );
              toast.error(
                `Failed to load existing signature image (ID: ${ann.id}).`
              );
            },
          }
        );
      } else if (ann.objectData) {
        console.log(`initializeFabricCanvas: Rendering existing object (ID: ${ann.id}, Type: ${ann.type})`);
        fabricRef.current.util.enlivenObjects(
          [ann.objectData],
          function (objects) {
            objects.forEach(function (obj) {
              obj.set({
                id: ann.id,
                name: ann.type,
                ...(ann.type === "text_field" && {
                  text: ann.text || obj.text,
                }),
              });
              canvas.add(obj);
              obj.setCoords();
            });
            canvas.renderAll();
            console.log(`initializeFabricCanvas: Added existing object (ID: ${ann.id}) to canvas.`);
          },
          "fabric"
        );
      }
    });

    // Clear previous event listeners to prevent duplicates
    console.log("initializeFabricCanvas: Clearing previous canvas event listeners.");
    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");
    canvas.off("mouse:dblclick");
    canvas.off("object:modified"); // Ensure this is also cleared and re-attached

    // Logic for 'place_signature' mode
    if (annotationMode === "place_signature" && userSignature && fabricRef.current) {
      console.log("initializeFabricCanvas: Entering 'place_signature' mode logic.");
      canvas.hoverCursor = "copy";
      canvas.selection = false;

      const handleCanvasClick = (options) => {
        console.log("handleCanvasClick: Mouse down event detected. Target:", options.target);
        if (!options.target && userSignature) {
          console.log("handleCanvasClick: Click on empty space, proceeding to place signature.");
          const pointer = canvas.getPointer(options.e);
          const x = pointer.x;
          const y = pointer.y;
          console.log(`handleCanvasClick: Click coordinates X: ${x}, Y: ${y}`);

          fabricRef.current.Image.fromURL(
            userSignature,
            function (img) {
              console.log("handleCanvasClick: Signature image loaded into Fabric.js.");
              const defaultSignatureWidth = 150;
              const defaultSignatureHeight = 50;

              let scaleX = 1;
              let scaleY = 1;
              if (img.width > 0 && img.height > 0) {
                scaleX = defaultSignatureWidth / img.width;
                scaleY = defaultSignatureHeight / img.height;
                console.log(`handleCanvasClick: Scaling image to ${scaleX}x / ${scaleY}y.`);
              }

              img.set({
                left: x - (img.width * scaleX) / 2,
                top: y - (img.height * scaleY) / 2,
                scaleX: scaleX,
                scaleY: scaleY,
                selectable: true,
                hasControls: true,
                name: "placed_signature",
                id: fabricRef.current.util.createUID(),
                originX: "left",
                originY: "top",
                imageData: userSignature,
              });

              canvas.add(img);
              canvas.renderAll();
              console.log("handleCanvasClick: Signature image added to canvas and rendered.");

              setAllAnnotations((prev) => {
                const newAnnotation = {
                  id: img.id,
                  documentId: documentId,
                  page: pageNumber,
                  type: "placed_signature",
                  x: img.left,
                  y: img.top,
                  width: img.width * img.scaleX,
                  height: img.height * img.scaleY,
                  imageData: userSignature,
                  objectData: img.toJSON(),
                };
                const updatedAnnotations = [...prev, newAnnotation];
                console.log("handleCanvasClick: New signature annotation added to state. Total:", updatedAnnotations.length);
                saveAnnotations(updatedAnnotations);
                return updatedAnnotations;
              });
            },
            {
              crossOrigin: "anonymous",
              onError: (err) => {
                console.error(
                  "handleCanvasClick: Fabric.js Image loading failed for new signature:",
                  err
                );
                toast.error("Failed to load your signature image.");
              },
            }
          );
        } else if (options.target) {
            console.log("handleCanvasClick: Clicked on an existing Fabric object, not placing signature.");
        } else {
            console.log("handleCanvasClick: userSignature is not available, cannot place signature.");
        }
      };
      canvas.on("mouse:down", handleCanvasClick);
      console.log("initializeFabricCanvas: 'mouse:down' listener attached for place_signature mode.");

      return () => {
        canvas.off("mouse:down", handleCanvasClick);
        canvas.selection = true;
        canvas.hoverCursor = "default";
        console.log("initializeFabricCanvas: 'place_signature' mode cleanup: 'mouse:down' listener removed.");
      };
    }

    // Logic for 'signature_field' mode
    if (annotationMode === "signature_field" && fabricRef.current) {
      console.log("initializeFabricCanvas: Entering 'signature_field' mode logic.");
      canvas.hoverCursor = "crosshair";
      canvas.selection = false;
      let isDrawing = false;
      let origX, origY;

      const handleMouseDown = (o) => {
        console.log("handleMouseDown (signature_field): Mouse down event.");
        if (o.target) {
            console.log("handleMouseDown (signature_field): Clicked on existing object, not starting draw.");
            return;
        }
        isDrawing = true;
        const pointer = canvas.getPointer(o.e);
        origX = pointer.x;
        origY = pointer.y;
        console.log(`handleMouseDown (signature_field): Starting draw at X: ${origX}, Y: ${origY}`);
        const rect = new fabricRef.current.Rect({
          left: origX,
          top: origY,
          width: 0,
          height: 0,
          fill: "rgba(255, 255, 0, 0.3)",
          stroke: "orange",
          strokeWidth: 2,
          selectable: true,
          hasControls: true,
          name: "signature_field",
          id: fabricRef.current.util.createUID(),
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        console.log("handleMouseDown (signature_field): New signature field rect added.");
      };

      const handleMouseMove = (o) => {
        if (!isDrawing) return;
        const pointer = canvas.getPointer(o.e);
        if (origX > pointer.x) {
          canvas.getActiveObject().set({ left: Math.abs(pointer.x) });
        }
        if (origY > pointer.y) {
          canvas.getActiveObject().set({ top: Math.abs(pointer.y) });
        }
        canvas.getActiveObject().set({
          width: Math.abs(origX - pointer.x),
          height: Math.abs(origY - pointer.y),
        });
        canvas.renderAll();
      };

      const handleMouseUp = () => {
        console.log("handleMouseUp (signature_field): Mouse up event, finalizing draw.");
        isDrawing = false;
        const newField = canvas.getActiveObject();
        if (newField && newField.width > 5 && newField.height > 5) {
          console.log(`handleMouseUp (signature_field): Field created with width ${newField.width}, height ${newField.height}`);
          setAllAnnotations((prev) => {
            const newAnnotation = {
              id: newField.id,
              documentId: documentId,
              page: pageNumber,
              type: "signature_field",
              x: newField.left,
              y: newField.top,
              width: newField.width * (newField.scaleX || 1),
              height: newField.height * (newField.scaleY || 1),
              objectData: newField.toJSON(),
            };
            const updatedAnnotations = [...prev, newAnnotation];
            console.log("handleMouseUp (signature_field): New signature field annotation added to state. Total:", updatedAnnotations.length);
            saveAnnotations(updatedAnnotations);
            return updatedAnnotations;
          });
          toast.success("Signature field added!");
        } else if (newField) {
            console.log("handleMouseUp (signature_field): Field too small, removing.");
            canvas.remove(newField);
            toast.error("Signature field was too small and removed.");
        }
      };

      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);
      console.log("initializeFabricCanvas: 'mouse:down', 'mouse:move', 'mouse:up' listeners attached for signature_field mode.");

      return () => {
        canvas.off("mouse:down", handleMouseDown);
        canvas.off("mouse:move", handleMouseMove);
        canvas.off("mouse:up", handleMouseUp);
        canvas.selection = true;
        canvas.hoverCursor = "default";
        console.log("initializeFabricCanvas: 'signature_field' mode cleanup: listeners removed.");
      };
    }

    // Logic for 'text_field' mode
    if (annotationMode === "text_field" && fabricRef.current) {
      console.log("initializeFabricCanvas: Entering 'text_field' mode logic.");
      canvas.hoverCursor = "text";
      canvas.selection = false;

      const handleTextFieldDoubleClick = (options) => {
        console.log("handleTextFieldDoubleClick: Double click event detected. Target:", options.target);
        if (!options.target) {
          const pointer = canvas.getPointer(options.e);
          console.log(`handleTextFieldDoubleClick: Double click on empty space at X: ${pointer.x}, Y: ${pointer.y}`);
          const newText = new fabricRef.current.IText("Double click to edit", {
            left: pointer.x,
            top: pointer.y,
            fontSize: 16,
            fill: "#000",
            editable: true,
            selectable: true,
            hasControls: true,
            name: "text_field",
            id: fabricRef.current.util.createUID(),
          });

          canvas.add(newText);
          canvas.setActiveObject(newText);
          canvas.renderAll();
          console.log("handleTextFieldDoubleClick: New text field added to canvas.");

          setAllAnnotations((prev) => {
            const newAnnotation = {
              id: newText.id,
              documentId: documentId,
              page: pageNumber,
              type: "text_field",
              x: newText.left,
              y: newText.top,
              width: newText.width * (newText.scaleX || 1),
              height: newText.height * (newText.scaleY || 1),
              text: newText.text,
              objectData: newText.toJSON(),
            };
            const updatedAnnotations = [...prev, newAnnotation];
            console.log("handleTextFieldDoubleClick: New text field annotation added to state. Total:", updatedAnnotations.length);
            saveAnnotations(updatedAnnotations);
            return updatedAnnotations;
          });
          toast.success("Text field added! Double-click to edit.");
        } else {
            console.log("handleTextFieldDoubleClick: Double clicked on an existing object.");
        }
      };
      canvas.on("mouse:dblclick", handleTextFieldDoubleClick);
      console.log("initializeFabricCanvas: 'mouse:dblclick' listener attached for text_field mode.");


      return () => {
        canvas.off("mouse:dblclick", handleTextFieldDoubleClick);
        canvas.selection = true;
        canvas.hoverCursor = "default";
        console.log("initializeFabricCanvas: 'text_field' mode cleanup: 'mouse:dblclick' listener removed.");
      };
    }

    // Always attach object:modified for persistent editing
    canvas.on("object:modified", function (e) {
      const modifiedObject = e.target;
      console.log(`object:modified: Object (ID: ${modifiedObject.id}, Type: ${modifiedObject.name}) was modified.`);
      if (!modifiedObject.id) {
        console.warn("object:modified: Modified object has no ID. Cannot persist reliably.");
        return;
      }

      setAllAnnotations((prev) => {
        const updated = prev.map((ann) => {
          if (ann.id === modifiedObject.id && ann.page === pageNumber) {
            console.log(`object:modified: Updating annotation ID ${ann.id} in state.`);
            const imageData =
              modifiedObject.name === "placed_signature"
                ? ann.imageData // Preserve original image data for signatures
                : undefined;

            return {
              ...ann,
              objectData: modifiedObject.toJSON(), // Save the full Fabric.js object data
              x: modifiedObject.left,
              y: modifiedObject.top,
              width: modifiedObject.width * (modifiedObject.scaleX || 1),
              height: modifiedObject.height * (modifiedObject.scaleY || 1),
              ...(modifiedObject.text && { text: modifiedObject.text }), // Update text if it's a text field
              ...(imageData && { imageData: imageData }),
            };
          }
          return ann;
        });
        saveAnnotations(updated);
        return updated;
      });
    });
    console.log("initializeFabricCanvas: 'object:modified' listener attached.");


    // Set default cursor and selection based on current mode
    if (annotationMode === "view") {
      canvas.hoverCursor = "default";
      canvas.selection = true;
      console.log("initializeFabricCanvas: Annotation mode is 'view', setting selection to true.");
    } else {
      // For other modes, we might start with selection as false then enable on cleanup
      // This ensures objects can be moved after creation.
      canvas.selection = true; // Allow selection and manipulation of newly created annotations
      canvas.hoverCursor = "default";
      console.log(`initializeFabricCanvas: Annotation mode is '${annotationMode}', setting selection to true for editing.`);
    }
  }, [
    pageNumber,
    annotationMode,
    allAnnotations,
    saveAnnotations,
    userSignature,
    documentId,
    displayPdfUrl,
    fabricRef,
    currentPageAnnotations, // This dependency might cause re-initialization if prop changes externally
  ]);

  useEffect(() => {
    console.log("useEffect: fileUrl or documentId changed. Resetting displayPdfUrl and annotations.");
    setDisplayPdfUrl(fileUrl);
    setAllAnnotations([]); // Clear existing annotations when document changes
    if (documentId) {
      fetchAnnotations(); // Fetch new annotations for the new document
    }
  }, [fileUrl, documentId, fetchAnnotations]);

  useEffect(() => {
    console.log("useEffect: displayPdfUrl or pageNumber changed. Re-initializing Fabric Canvas.");
    if (displayPdfUrl && !displayPdfUrl.includes("finalized_")) {
      console.log("useEffect: PDF is not finalized. Setting up ResizeObserver and initializing Fabric canvas.");
      const resizeObserver = new ResizeObserver(() => {
        console.log("ResizeObserver: Page container resized, re-initializing Fabric Canvas.");
        initializeFabricCanvas();
      });

      if (pageContainerRef.current) {
        resizeObserver.observe(pageContainerRef.current);
      }

      return () => {
        console.log("useEffect Cleanup: Removing ResizeObserver and disposing Fabric canvas.");
        if (pageContainerRef.current) {
          resizeObserver.unobserve(pageContainerRef.current);
        }
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }
      };
    } else {
      console.log("useEffect Cleanup: PDF is finalized or no URL. Disposing Fabric canvas if exists.");
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    }
  }, [pageNumber, displayPdfUrl, initializeFabricCanvas]);

  function onDocumentLoadSuccess({ numPages }) {
    console.log("onDocumentLoadSuccess: Document loaded. Total pages:", numPages);
    setNumPages(numPages);
    setPageNumber(1); // Reset to first page on new document load
    setTimeout(() => {
        console.log("onDocumentLoadSuccess: Initializing Fabric canvas after slight delay.");
        initializeFabricCanvas();
    }, 100);
  }

  const goToNextPage = () => {
    console.log("goToNextPage: Attempting to go to next page.");
    setPageNumber((prevPageNumber) => {
      const newPage = Math.min(prevPageNumber + 1, numPages);
      console.log(`goToNextPage: Changing page from ${prevPageNumber} to ${newPage}.`);
      return newPage;
    });
    // A slight delay ensures the PDF page renders before Fabric.js initializes on top of it.
    setTimeout(() => {
        console.log("goToNextPage: Initializing Fabric canvas for new page after slight delay.");
        initializeFabricCanvas();
    }, 50);
  };

  const goToPrevPage = () => {
    console.log("goToPrevPage: Attempting to go to previous page.");
    setPageNumber((prevPageNumber) => {
      const newPage = Math.max(prevPageNumber - 1, 1);
      console.log(`goToPrevPage: Changing page from ${prevPageNumber} to ${newPage}.`);
      return newPage;
    });
    setTimeout(() => {
        console.log("goToPrevPage: Initializing Fabric canvas for new page after slight delay.");
        initializeFabricCanvas();
    }, 50);
  };

  const onPageRenderSuccess = useCallback(({ width, height }) => {
    console.log(`onPageRenderSuccess: PDF page rendered. Width: ${width}, Height: ${height}.`);
    if (fabricCanvasRef.current && canvasRef.current) {
      fabricCanvasRef.current.setDimensions({ width: width, height: height });
      canvasRef.current.style.width = `${width}px`;
      canvasRef.current.style.height = `${height}px`;
      fabricCanvasRef.current.renderAll();
      console.log("onPageRenderSuccess: Fabric canvas dimensions updated to match PDF page.");
    }
  }, []);

  if (!displayPdfUrl) {
    console.log("PdfViewer: No PDF URL provided, displaying placeholder.");
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg text-gray-500 text-lg border border-dashed border-gray-300 min-h-[400px]">
        <p>Select a document to start viewing.</p>
      </div>
    );
  }

  console.log("PdfViewer: Rendering PDF viewer with buttons.");
  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 rounded-lg shadow-inner w-full">
      <div className="mb-4 space-x-2 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => {
            setAnnotationMode("view");
            console.log("Button Click: Set annotation mode to 'view'.");
          }}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            annotationMode === "view"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          disabled={
            isFinalizing ||
            (displayPdfUrl && displayPdfUrl.includes("finalized_"))
          }
        >
          View
        </button>
        <button
          onClick={() => {
            setAnnotationMode("signature_field");
            toast("Click and drag on the PDF to create a signature field.");
            console.log("Button Click: Set annotation mode to 'signature_field'.");
          }}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            annotationMode === "signature_field"
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          disabled={
            isFinalizing ||
            (displayPdfUrl && displayPdfUrl.includes("finalized_"))
          }
        >
          Add Signature Field
        </button>

        <button
          onClick={() => {
            if (!userSignature) {
              toast.error("Please create or upload your signature first!");
              console.warn("Button Click: Cannot set to 'place_signature' mode, userSignature is missing.");
              return;
            }
            setAnnotationMode("place_signature");
            toast("Click on the PDF to place your signature.");
            console.log("Button Click: Set annotation mode to 'place_signature'.");
          }}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            annotationMode === "place_signature"
              ? "bg-emerald-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          disabled={
            isFinalizing ||
            !userSignature ||
            (displayPdfUrl && displayPdfUrl.includes("finalized_"))
          }
        >
          Place My Signature
        </button>

        <button
          onClick={() => {
            setAnnotationMode("text_field");
            toast("Double-click on the PDF to add a text field.");
            console.log("Button Click: Set annotation mode to 'text_field'.");
          }}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            annotationMode === "text_field"
              ? "bg-purple-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          disabled={
            isFinalizing ||
            (displayPdfUrl && displayPdfUrl.includes("finalized_"))
          }
        >
          Add Text Field
        </button>

        {!displayPdfUrl.includes("finalized_") && (
          <button
            onClick={handleFinalizeDocument}
            className={`ml-4 px-4 py-2 rounded-lg font-semibold text-white transition-colors duration-200 ease-in-out
                                ${
                                  isFinalizing
                                    ? "bg-orange-400 cursor-not-allowed"
                                    : "bg-orange-500 hover:bg-orange-600"
                                }`}
            disabled={isFinalizing}
          >
            {isFinalizing ? "Finalizing..." : "Finalize Document"}
          </button>
        )}

        {(annotationMode === "signature_field" ||
          annotationMode === "place_signature") &&
          !userSignature && (
            <span className="text-red-500 text-sm ml-2 mt-2 md:mt-0 w-full text-center md:w-auto">
              Please create a signature first!
            </span>
          )}
        {displayPdfUrl && displayPdfUrl.includes("finalized_") && (
          <span className="text-green-700 text-sm ml-2 mt-2 md:mt-0 w-full text-center md:w-auto font-bold">
            This is a FINALIZED document.
          </span>
        )}
      </div>

      <div
        ref={combineRefs}
        className={`relative w-full max-w-full overflow-auto border border-gray-300 rounded-md bg-white flex justify-center ${
          isOver ? "border-dashed border-blue-500" : ""
        }`}
        style={{ minHeight: "600px" }}
      >
        {isFinalizing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
              <p className="mt-3 text-lg font-semibold text-blue-700">
                Processing Document...
              </p>
            </div>
          </div>
        )}

        <Document
          file={displayPdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => console.log("Error loading PDF:", error)}
          className="relative"
        >
          <Page
            pageNumber={pageNumber}
            renderAnnotationLayer={!displayPdfUrl.includes("finalized_")}
            renderTextLayer={!displayPdfUrl.includes("finalized_")}
            className="flex justify-center"
            onRenderSuccess={onPageRenderSuccess}
          />
        </Document>

        {!displayPdfUrl.includes("finalized_") && (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            style={{ zIndex: 10 }}
          />
        )}
      </div>

      {numPages && (
        <div className="flex items-center justify-center mt-4 space-x-4">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <p className="text-gray-700 font-medium">
            Page {pageNumber} of {numPages}
          </p>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}