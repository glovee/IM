import { useState } from 'react';
import { Outlet } from 'react-router';
import TopBar from './TopBar.tsx';
import Sidebar from './Sidebar.tsx';
import { useTeamsStore } from '../store/teamsStore.ts';
import { User } from '../types/incident.ts';

// Временный mock пользователь (будет заменён на авторизацию)
const currentUser: User = {
  id: 'u1',
  name: 'Иван Петров',
  email: 'ivan.petrov@company.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ivan'
};

export default function MainLayout() {
  const teams = useTeamsStore((state) => state.teams);
  const [activeTeam, setActiveTeam] = useState(teams[0]?.name || '');

  const handleLogout = () => {
    console.log('Выход из системы');
    // Здесь будет логика выхода из системы
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-950">
      <TopBar
        user={currentUser}
        activeTeam={activeTeam}
        onTeamChange={setActiveTeam}
        onLogout={handleLogout}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950">
          <Outlet context={{ activeTeam }} />
        </main>
      </div>
    </div>
  );
}
