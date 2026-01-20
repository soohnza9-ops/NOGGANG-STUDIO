import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import App from "../App";
import Login from "../components/Login";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<App />} />
    </Routes>
  </BrowserRouter>
);
