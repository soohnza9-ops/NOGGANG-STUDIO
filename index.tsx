import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./components/src/pages/Home";
import Login from "./components/Login";
import App from "./App";
import Layout from "./components/Layout";
import AuthPage from "./components/AuthPage";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");

ReactDOM.createRoot(root).render(
  <HashRouter>
    <Routes>
      {/* Layout은 항상 유지 */}
      <Route element={<Layout />}>
        {/* 홈은 로그인 불필요 */}
        <Route path="/" element={<Home />} />

        {/* 편집기만 로그인 보호 */}
        <Route
          path="/app"
          element={
            <AuthPage>
              <App />
            </AuthPage>
          }
        />
      </Route>

      {/* 로그인 페이지 */}
      <Route path="/login" element={<Login />} />
    </Routes>
  </HashRouter>
);
