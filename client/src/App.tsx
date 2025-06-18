import { Route, Switch } from "wouter";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { AddDogPage } from "./pages/AddDogPage";
import { AddRunPage } from "./pages/AddRunPage";
import { EditDogPage } from "./pages/EditDogPage";
import { LoginPage } from "./pages/LoginPage";
import { MainMenuPage } from "./pages/MainMenuPage";
import { MyDogsPage } from "./pages/MyDogsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TitleProgressPage } from "./pages/TitleProgressPage";
import { ViewRunsPage } from "./pages/ViewRunsPage";

function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/login" component={LoginPage} />
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
          </Switch>
        </ProtectedRoute>
      </Switch>
    </AuthProvider>
  );
}

export default App;
