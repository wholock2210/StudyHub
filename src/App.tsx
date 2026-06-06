import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CreateSet from './pages/CreateSet';
import QuizEditor from './pages/QuizEditor';
import VocabEditor from './pages/VocabEditor';
import FlashCard from './pages/FlashCard';
import Quiz from './pages/Quiz';
import QuizList from './pages/QuizList';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';
import GeneratePage from './pages/GeneratePage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sets" element={<QuizList />} />
        <Route path="/create" element={<CreateSet />} />
        <Route path="/create/quiz" element={<QuizEditor />} />
        <Route path="/create/vocab" element={<VocabEditor />} />
        <Route path="/flash" element={<FlashCard />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
