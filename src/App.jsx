import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import DeckDetail from "./pages/DeckDetail";
import DeckImport from "./pages/DeckImport";
import DeckList from "./pages/DeckList";

export default function App() {
  return (
    <>
      <NavBar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<DeckList />} />
          <Route path="/importar" element={<DeckImport />} />
          <Route path="/mazo/:id" element={<DeckDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
