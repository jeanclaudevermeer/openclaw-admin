import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GatewayHeader } from '@/components/GatewayHeader'
import { AgentsPage } from '@/components/AgentsPage'
import { SkillsPage } from '@/components/SkillsPage'
import { CronPage } from '@/components/CronPage'
import { ChannelsPage } from '@/components/ChannelsPage'
import { ConfigPage } from '@/components/ConfigPage'

const tabs = [
  { value: 'agents', label: 'Agents' },
  { value: 'skills', label: 'Skills' },
  { value: 'cron', label: 'Cron' },
  { value: 'channels', label: 'Channels' },
  { value: 'config', label: 'Config' },
]

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <GatewayHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-10 pt-24">
        <Tabs defaultValue="agents" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="agents" className="mt-6">
            <AgentsPage />
          </TabsContent>
          <TabsContent value="skills" className="mt-6">
            <SkillsPage />
          </TabsContent>
          <TabsContent value="cron" className="mt-6">
            <CronPage />
          </TabsContent>
          <TabsContent value="channels" className="mt-6">
            <ChannelsPage />
          </TabsContent>
          <TabsContent value="config" className="mt-6">
            <ConfigPage />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default App
