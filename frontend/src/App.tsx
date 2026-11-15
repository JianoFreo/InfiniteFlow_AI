import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Studio from "./pages/Studio";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Studio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
