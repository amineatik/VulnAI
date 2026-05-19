'use client'

import MainLayout from '@/components/main-layout'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Bell, Globe, Palette, Shield, Database,
  Save, ChevronRight, Moon, Sun, Monitor, Check, ToggleLeft, ToggleRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}
const stagger = { show: { transition: { staggerChildren: 0.07 } } }

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-all duration-200 ${value ? 'bg-red-600' : 'bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2.5">
        <span className="text-red-400">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    browser: false,
    critical: true,
    weekly: false,
    scanComplete: true,
  })

  const [scanSettings, setScanSettings] = useState({
    autoScan: false,
    deepScan: true,
    saveLogs: true,
    timeout: '30',
    concurrency: '3',
  })

  const [apiUrl, setApiUrl] = useState('http://localhost:8000')
  const [theme, setTheme] = useState<'dark' | 'system'>('dark')
  const [language, setLanguage] = useState('fr')

  const handleSave = () => {
    toast.success('Paramètres sauvegardés')
  }

  return (
    <MainLayout>
      <div
        style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
        className="min-h-screen bg-[#0a0a0a] text-slate-100 p-6 space-y-6"
      >
        <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400 tracking-widest uppercase">Configuration</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  <span className="text-red-400">Settings</span>
                </h1>
              </div>
              <Button onClick={handleSave}
                className="bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 text-xs gap-1.5">
                <Save size={12} /> Sauvegarder
              </Button>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div variants={fadeUp}>
            <Section icon={<Bell size={14} />} title="Notifications">
              <SettingRow label="Email alerts" description="Recevoir les alertes par email">
                <Toggle value={notifications.email} onChange={v => setNotifications({ ...notifications, email: v })} />
              </SettingRow>
              <SettingRow label="Notifications navigateur" description="Alertes dans le navigateur">
                <Toggle value={notifications.browser} onChange={v => setNotifications({ ...notifications, browser: v })} />
              </SettingRow>
              <SettingRow label="Alertes critiques uniquement" description="Notifier seulement pour les CVE critiques">
                <Toggle value={notifications.critical} onChange={v => setNotifications({ ...notifications, critical: v })} />
              </SettingRow>
              <SettingRow label="Rapport hebdomadaire" description="Résumé chaque lundi matin">
                <Toggle value={notifications.weekly} onChange={v => setNotifications({ ...notifications, weekly: v })} />
              </SettingRow>
              <SettingRow label="Fin de scan" description="Notification quand un scan est terminé">
                <Toggle value={notifications.scanComplete} onChange={v => setNotifications({ ...notifications, scanComplete: v })} />
              </SettingRow>
            </Section>
          </motion.div>

          {/* Scan Settings */}
          <motion.div variants={fadeUp}>
            <Section icon={<Shield size={14} />} title="Paramètres de scan">
              <SettingRow label="Scan automatique" description="Scanner les nouvelles cibles automatiquement">
                <Toggle value={scanSettings.autoScan} onChange={v => setScanSettings({ ...scanSettings, autoScan: v })} />
              </SettingRow>
              <SettingRow label="Mode deep scan" description="Analyse approfondie (plus lente)">
                <Toggle value={scanSettings.deepScan} onChange={v => setScanSettings({ ...scanSettings, deepScan: v })} />
              </SettingRow>
              <SettingRow label="Sauvegarder les logs" description="Conserver les logs détaillés des scans">
                <Toggle value={scanSettings.saveLogs} onChange={v => setScanSettings({ ...scanSettings, saveLogs: v })} />
              </SettingRow>
              <SettingRow label="Timeout (secondes)" description="Durée max d'attente par requête">
                <Input
                  type="number"
                  value={scanSettings.timeout}
                  onChange={e => setScanSettings({ ...scanSettings, timeout: e.target.value })}
                  className="w-20 bg-slate-800 border-slate-700 text-sm h-8 text-center"
                />
              </SettingRow>
              <SettingRow label="Concurrence" description="Nombre de requêtes simultanées">
                <Input
                  type="number"
                  value={scanSettings.concurrency}
                  onChange={e => setScanSettings({ ...scanSettings, concurrency: e.target.value })}
                  className="w-20 bg-slate-800 border-slate-700 text-sm h-8 text-center"
                />
              </SettingRow>
            </Section>
          </motion.div>

          {/* API */}
          <motion.div variants={fadeUp}>
            <Section icon={<Database size={14} />} title="Connexion API">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">URL du serveur backend</label>
                <div className="flex gap-2">
                  <Input
                    value={apiUrl}
                    onChange={e => setApiUrl(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-sm h-9 font-mono"
                    placeholder="http://localhost:8000"
                  />
                  <Button size="sm" variant="outline"
                    className="border-slate-700 text-slate-300 text-xs whitespace-nowrap"
                    onClick={() => toast.success('Connexion OK')}>
                    Tester
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Modifie aussi la variable <span className="text-red-400 font-mono">NEXT_PUBLIC_API_URL</span> dans <span className="text-red-400 font-mono">.env.local</span>
                </p>
              </div>
            </Section>
          </motion.div>

          {/* Apparence */}
          <motion.div variants={fadeUp}>
            <Section icon={<Palette size={14} />} title="Apparence & Langue">
              <SettingRow label="Thème" description="Apparence de l'interface">
                <div className="flex gap-1.5">
                  {([
                    { id: 'dark', icon: <Moon size={12} />, label: 'Dark' },
                    { id: 'system', icon: <Monitor size={12} />, label: 'Système' },
                  ] as const).map(t => (
                    <button key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                        theme === t.id
                          ? 'bg-red-600/15 border-red-500/40 text-red-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Langue" description="Langue de l'interface">
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-500/50"
                >
                  <option value="fr">🇫🇷 Français</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="ar">🇲🇦 العربية</option>
                </select>
              </SettingRow>
            </Section>
          </motion.div>

          {/* Danger zone */}
          <motion.div variants={fadeUp}>
            <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                ⚠️ Zone de danger
              </h3>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm text-slate-300">Supprimer toutes les données</p>
                  <p className="text-xs text-slate-500">Supprime tous les scans et vulnérabilités.</p>
                </div>
                <Button size="sm"
                  className="bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-xs"
                  onClick={() => toast.error('Action non disponible en démo')}>
                  Réinitialiser
                </Button>
              </div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </MainLayout>
  )
}
