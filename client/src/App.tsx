import { Route, Switch } from "wouter";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { PWAProvider } from "./contexts/PWAContext";
import { AboutPage } from "./pages/AboutPage";
import { AddDogPage } from "./pages/AddDogPage";
import { AddRunPage } from "./pages/AddRunPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ConfirmSignupPage } from "./pages/ConfirmSignupPage";
import { DebugPage } from "./pages/DebugPage";
import { EditDogPage } from "./pages/EditDogPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { MainMenuPage } from "./pages/MainMenuPage";
import { MyDogsPage } from "./pages/MyDogsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SignupPage } from "./pages/SignupPage";
import { TitleProgressPage } from "./pages/TitleProgressPage";
import { ViewRunsPage } from "./pages/ViewRunsPage";
import { WelcomePage } from "./pages/WelcomePage";

function App() {
  return (
    <ErrorBoundary>
      <PWAProvider>
        <AuthProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/confirm-signup" component={ConfirmSignupPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/debug" component={DebugPage} />
          <ProtectedRoute>
            <Switch>
              <Route path="/" component={MainMenuPage} />
              <Route path="/welcome" component={WelcomePage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/add-run" component={AddRunPage} />
              <Route path="/view-runs" component={ViewRunsPage} />
              <Route path="/title-progress" component={TitleProgressPage} />
              <Route path="/my-dogs" component={MyDogsPage} />
              <Route path="/dogs" component={MyDogsPage} />
              <Route path="/dogs/add" component={AddDogPage} />
              <Route path="/dogs/:dogId/edit" component={EditDogPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/import" component={ImportPage} />
            </Switch>
          </ProtectedRoute>
        </Switch>
      </AuthProvider>
      </PWAProvider>
    </ErrorBoundary>
  );
}

export default App;
