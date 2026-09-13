import AuthCard from "./AuthCard.jsx";

export default function Login({ onSignedIn }) {
  return <AuthCard onSignedIn={onSignedIn} initialTab="login" />;
}

