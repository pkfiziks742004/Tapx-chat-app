import { useState, useEffect } from "react";

export default function Avatar({ name, url = "", size = 36 }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  const initials = String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="avatar" style={{ width: size, height: size, minWidth: size }}>
      {url && !hasError ? (
        <img
          className="avatarImg"
          src={url}
          alt={name || "Avatar"}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        initials || "?"
      )}
    </div>
  );
}

