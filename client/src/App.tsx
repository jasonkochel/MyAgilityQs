import { Route, Switch } from "wouter";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { PWAProvider } from "./contexts/PWAContext";
import { AddDogPage } from "./pages/AddDogPage";
import { AddRunPage } from "./pages/AddRunPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DebugPage } from "./pages/DebugPage";
import { EditDogPage } from "./pages/EditDogPage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { MainMenuPage } from "./pages/MainMenuPage";
import { MyDogsPage } from "./pages/MyDogsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignupPage } from "./pages/SignupPage";
import { TitleProgressPage } from "./pages/TitleProgressPage";
import { ViewRunsPage } from "./pages/ViewRunsPage";

function App() {
  return (
    <ErrorBoundary>
      <PWAProvider>
        <AuthProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/debug" component={DebugPage} />
          <ProtectedRoute>
            <Switch>
              <Route path="/" component={MainMenuPage} />
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
