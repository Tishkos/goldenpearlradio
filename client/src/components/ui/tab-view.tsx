import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
  defaultTabId: string;
}

export function TabView({ tabs, defaultTabId }: TabViewProps) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId);
  
  // Find the active tab
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  
  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex flex-wrap border-b border-gray-200 mb-6">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant="ghost"
            className={`mr-4 py-2 px-3 relative text-base font-medium ${
              activeTabId === tab.id
                ? 'text-radio-orange border-b-2 border-radio-orange -mb-px'
                : 'text-gray-600 hover:text-radio-orange'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="tab-content">
        {activeTab.content}
      </div>
    </div>
  );
}