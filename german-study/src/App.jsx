import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StudyPage from "./pages/StudyPage";
import LearningWordsPage from "./pages/LearningWordsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudyPage />} />
        <Route path="/learning" element={<LearningWordsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}