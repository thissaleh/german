import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StudyPage from "./pages/StudyPage";
import LearningWordsPage from "./pages/LearningWordsPage";
import RecordingFocusPage from "./pages/RecordingFocusPage";
import RecordingFocusListsPage from "./pages/RecordingFocusListsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudyPage />} />
        <Route path="/learning" element={<LearningWordsPage />} />
        <Route path="/recording-focus" element={<RecordingFocusListsPage />} />
        <Route path="/recording-focus/:trackId" element={<RecordingFocusPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
