import { useEffect, useMemo, useRef, useState } from "react";
import { IconX } from "./Icons.jsx";

function clamp(n, a, b) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return a;
  return Math.min(b, Math.max(a, x));
}

export default function AvatarCropModal({ file, onCancel, onCropped }) {
  const [imgUrl, setImgUrl] = useState("");
  const [imgEl, setImgEl] = useState(null);
  const [zoom, setZoom] = useState(1.05);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [boxSize, setBoxSize] = useState(280);

  const boxRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseDx: 0, baseDy: 0 });

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setZoom(1.05);
    setDx(0);
    setDy(0);

    const img = new Image();
    img.onload = () => setImgEl(img);
    img.onerror = () => setImgEl(null);
    img.src = url;

    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch (_e) {}
    };
  }, [file]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      try {
        const w = el.getBoundingClientRect?.().width || 0;
        if (w > 10) setBoxSize(w);
      } catch (_e) {}
    };
    update();

    let ro = null;
    try {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } catch (_e) {}

    window.addEventListener("resize", update);
    return () => {
      try {
        ro?.disconnect?.();
      } catch (_e) {}
      window.removeEventListener("resize", update);
    };
  }, []);

  const sizing = useMemo(() => {
    const iw = Number(imgEl?.naturalWidth || 0);
    const ih = Number(imgEl?.naturalHeight || 0);
    if (!iw || !ih) return null;
    const baseScale = Math.max(boxSize / iw, boxSize / ih);
    const scale = baseScale * clamp(zoom, 1, 3);
    const renderW = iw * scale;
    const renderH = ih * scale;
    const maxDx = Math.max(0, renderW / 2 - boxSize / 2);
    const maxDy = Math.max(0, renderH / 2 - boxSize / 2);
    return { iw, ih, baseScale, scale, renderW, renderH, maxDx, maxDy };
  }, [imgEl, boxSize, zoom]);

  useEffect(() => {
    if (!sizing) return;
    setDx((v) => clamp(v, -sizing.maxDx, sizing.maxDx));
    setDy((v) => clamp(v, -sizing.maxDy, sizing.maxDy));
  }, [sizing?.maxDx, sizing?.maxDy]);

  function onPointerDown(e) {
    if (!sizing) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseDx: dx,
      baseDy: dy
    };
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch (_e) {}
  }

  function onPointerMove(e) {
    if (!sizing) return;
    const st = dragRef.current || {};
    if (!st.active) return;
    const nx = st.baseDx + (e.clientX - st.startX);
    const ny = st.baseDy + (e.clientY - st.startY);
    setDx(clamp(nx, -sizing.maxDx, sizing.maxDx));
    setDy(clamp(ny, -sizing.maxDy, sizing.maxDy));
  }

  function onPointerUp() {
    dragRef.current = { active: false, startX: 0, startY: 0, baseDx: 0, baseDy: 0 };
  }

  async function save() {
    if (!imgEl || !sizing || !file) return;
    setError("");
    setSaving(true);
    try {
      const out = 512;
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      const left = boxSize / 2 - sizing.renderW / 2 + dx;
      const top = boxSize / 2 - sizing.renderH / 2 + dy;
      const sx = (0 - left) / sizing.scale;
      const sy = (0 - top) / sizing.scale;
      const sw = boxSize / sizing.scale;
      const sh = boxSize / sizing.scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        imgEl,
        clamp(sx, 0, Math.max(0, sizing.iw - sw)),
        clamp(sy, 0, Math.max(0, sizing.ih - sh)),
        Math.min(sizing.iw, sw),
        Math.min(sizing.ih, sh),
        0,
        0,
        out,
        out
      );

      const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
      if (!blob) throw new Error("Could not create image");

      const cropped = new File([blob], `avatar-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
      onCropped?.(cropped);
    } catch (e) {
      setError(e?.message || "Could not crop photo.");
      setSaving(false);
    }
  }

  return (
    <div className="modalOverlay cropOverlay" onMouseDown={onCancel} role="presentation">
      <div className="modal cropModal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="cropHeader">
          <div className="modalTitle">Crop profile photo</div>
          <button className="cropCloseBtn" type="button" onClick={onCancel} aria-label="Close" title="Close">
            <IconX size={18} />
          </button>
        </div>

        <div className="cropBoxContainer">
          <div
            className="cropBox"
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="application"
            aria-label="Crop area"
          >
            {imgUrl && (
              <img
                className="cropImg"
                src={imgUrl}
                alt="Crop preview"
                draggable={false}
                style={{
                  width: sizing ? `${sizing.renderW}px` : undefined,
                  height: sizing ? `${sizing.renderH}px` : undefined,
                  transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)`
                }}
              />
            )}
            <div className="cropMask" aria-hidden="true" />
            <div className="cropCircleGuide" aria-hidden="true" />
          </div>
          <div className="cropHintText">Drag photo to adjust position</div>
        </div>

        <div className="cropZoomRow">
          <span className="cropZoomLabel">Zoom</span>
          <input
            className="cropZoomSlider"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modalActions">
          <button className="btn" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="btn primary" type="button" onClick={() => save().catch(() => {})} disabled={saving}>
            {saving ? "Saving…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
