import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
    const token = localStorage.getItem("forgex_token");

    return token ? <Dashboard /> : <Auth />;
}

export default App;
