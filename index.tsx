import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./components/src/pages/Home";
import Login from "./components/Login";
import App from "./App";
import Layout from "./components/Layout";

const root = document.getElementById("root");
if (!root) throw new Error("root not found");

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <Routes>
  <Route element={<Layout />}>
    <Route path="/" element={<Home />} />
    <Route path="/app" element={<App />} />
  </Route>

  <Route path="/login" element={<Login />} />
</Routes>
  </BrowserRouter>
);
