export default function Avatar({ name, url = "", size = 36 }) {
  const initials = String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {url ? <img className="avatarImg" src={url} alt={name || "Avatar"} loading="lazy" /> : initials || "?"}
    </div>
  );
}
