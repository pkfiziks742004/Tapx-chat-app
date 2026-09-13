import AuthCard from "./AuthCard.jsx";

export default function Register({ onSignedIn }) {
  return <AuthCard onSignedIn={onSignedIn} initialTab="signup" />;
}

