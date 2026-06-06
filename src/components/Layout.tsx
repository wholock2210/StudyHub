import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 overflow-x-hidden">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-4 py-4 sm:py-8">
        <div className="animate-fadeIn">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
