import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import "./index.css";
import App from "./App.jsx";
import { appUrl } from "./config.js";

// Cognito auth config
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yHc7CMv1O",
  client_id: "3isil38pk3rjglpvp0vse9q764",
  redirect_uri: appUrl,
  response_type: "code",
  scope: "phone openid email",
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Background layers */}
    <div className="bg-void" />
    <div className="bg-scanlines" />
    <div className="bg-grid" />
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>
);