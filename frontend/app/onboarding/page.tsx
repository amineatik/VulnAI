'use client'

import { useState } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, Circle, ArrowRight, ArrowLeft,
  Shield, Scan, Bell, Users, FileBarChart2,
  Globe, Zap, BookOpen, ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

interface Step {
  id: number
  title: string
  description: string
  icon: any
  color: string
  tasks: { label: string; href?: string; done: boolean }[]
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Configurer votre compte',
    description: 'Complétez votre profil et sécurisez votre accès',
    icon: Shield,
    color: '#ef4444',
    tasks: [
      { label: 'Créer un compte', done: true },
      { label: 'Compléter votre profil', href: '/profile', done: false },
      { label: 'Configurer les paramètres de sécurité', href: '/security', done: false },
    ],
  },
  {
    id: 2,
    title: 'Lancer votre premier scan',
    description: 'Analysez une cible pour détecter les vulnérabilités',
    icon: Scan,
    color: '#a78bfa',
    tasks: [
      { label: 'Accéder au module Scans', href: '/scans', done: false },
      { label: 'Créer un nouveau scan', href: '/scans/new', done: false },
      { label: 'Consulter les résultats', href: '/vulnerabilities', done: false },
    ],
  },
  {
    id: 3,
    title: 'Explorer les vulnérabilités',
    description: 'Analysez les résultats et priorisez les corrections',
    icon: Zap,
    color: '#f97316',
    tasks: [
      { label: 'Consulter le tableau de bord', href: '/dashboard', done: false },
      { label: 'Filtrer par sévérité', href: '/vulnerabilities', done: false },
      { label: 'Utiliser le Remediation Center', href: '/remediation', done: false },
    ],
  },
  {
    id: 4,
    title: 'Configurer les alertes',
    description: 'Restez informé des nouvelles menaces en temps réel',
    icon: Bell,
    color: '#22c55e',
    tasks: [
      { label: 'Consulter le Live Monitor', href: '/live-monitor', done: false },
      { label: 'Voir les notifications', href: '/notifications', done: false },
      { label: 'Configurer les intégrations', href: '/integrations', done: false },
    ],
  },
  {
    id: 5,
    title: 'Générer des rapports',
    description: 'Documentez votre posture de sécurité pour les parties prenantes',
    icon: FileBarChart2,
    color: '#eab308',
    tasks: [
      { label: 'Créer un rapport', href: '/reports', done: false },
      { label: 'Vérifier la conformité', href: '/compliance', done: false },
      { label: 'Consulter l\'audit trail', href: '/audit', done: false },
    ],
  },
  {
    id: 6,
    title: 'Inviter votre équipe',
    description: 'Collaborez avec vos collègues sur la sécurité',
    icon: Users,
    color: '#ec4899',
    tasks: [
      { label: 'Accéder à la gestion d\'équipe', href: '/team', done: false },
      { label: 'Inviter un premier membre', href: '/team', done: false },
      { label: 'Définir les rôles et permissions', href: '/team', done: false },
    ],
  },
]

const RESOURCES = [
  { icon: Globe,        label: 'Documentation API',     desc: 'Explorer les endpoints REST disponibles',    href: 'http://localhost:8000/docs' },
  { icon: BookOpen,     label: 'CVE Explorer',           desc: 'Rechercher des vulnérabilités connues',       href: '/cve-explorer' },
  { icon: Shield,       label: 'Politiques de sécurité', desc: 'Définir vos règles de sécurité',              href: '/policies' },
  { icon: FileBarChart2, label: 'Rapports',              desc: 'Générer des rapports de conformité',          href: '/reports' },
]

export default function OnboardingPage() {
  const { user: authUser } = useAuth()
  const displayName = authUser?.username ?? authUser?.email?.split('@')[0] ?? 'Analyste'

  const [activeStep, setActiveStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set([0]))

  const step = STEPS[activeStep]
  const Icon = step.icon
  const progress = Math.round((completedSteps.size / STEPS.length) * 100)

  const goNext = () => {
    const next = activeStep + 1
    if (next < STEPS.length) {
      setCompletedSteps(prev => new Set([...prev, next]))
      setActiveStep(next)
    }
  }

  const goPrev = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1)
  }

  const markStepDone = (stepId: number) => {
    setCompletedSteps(prev => new Set([...prev, stepId]))
  }

  return (
    <MainLayout>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="min-h-full bg-[#0a0a0a] p-6 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={14} className="text-red-400" />
            <span className="text-xs text-red-400 tracking-widest uppercase">Onboarding</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bienvenue, {displayName} 👋</h1>
          <p className="text-xs text-slate-500 mt-0.5">Suivez ces étapes pour configurer VulnAI et démarrer votre première analyse de sécurité.</p>
        </div>

        {/* Progress bar */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Progression de l'onboarding</span>
            <span className="text-xs font-bold text-red-400">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-gradient-to-r from-red-700 to-purple-500 rounded-full"
            />
          </div>
          <p className="text-xs text-slate-600 mt-2">{completedSteps.size} / {STEPS.length} étapes complétées</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Step list */}
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const SIcon = s.icon
              const isDone = completedSteps.has(i)
              const isActive = i === activeStep
              return (
                <button key={s.id} onClick={() => { setActiveStep(i); markStepDone(i) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'border-red-500/40 bg-red-600/10'
                      : isDone
                      ? 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                      : 'border-slate-800 bg-slate-900/20 hover:border-slate-700'
                  }`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: s.color + '15', border: `1px solid ${s.color}30` }}>
                    <SIcon size={14} style={{ color: s.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {s.title}
                    </p>
                  </div>
                  {isDone
                    ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                    : <Circle size={14} className="text-slate-700 flex-shrink-0" />
                  }
                </button>
              )
            })}
          </div>

          {/* Step detail */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key={activeStep}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">

                {/* Step header */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: step.color + '15', border: `1px solid ${step.color}30` }}>
                    <Icon size={20} style={{ color: step.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-slate-500 border border-slate-700">
                        Étape {activeStep + 1}/{STEPS.length}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white">{step.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                  </div>
                </div>

                {/* Tasks */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">Actions à effectuer</p>
                  {step.tasks.map((task, ti) => (
                    <div key={ti} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                      <CheckCircle size={14} className={task.done ? 'text-green-400' : 'text-slate-700'} />
                      <span className="text-xs text-slate-300 flex-1">{task.label}</span>
                      {task.href && (
                        <Link href={task.href}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                          Accéder <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <button onClick={goPrev} disabled={activeStep === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <ArrowLeft size={12} /> Précédent
                  </button>
                  {activeStep < STEPS.length - 1 ? (
                    <button onClick={goNext}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600/25 text-xs font-semibold transition-all">
                      Suivant <ArrowRight size={12} />
                    </button>
                  ) : (
                    <Link href="/dashboard"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 text-xs font-semibold transition-all">
                      Terminer <CheckCircle size={12} />
                    </Link>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Resources */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Ressources utiles</p>
              <div className="grid grid-cols-2 gap-2">
                {RESOURCES.map((r, i) => {
                  const RIcon = r.icon
                  const isExternal = r.href.startsWith('http')
                  return isExternal ? (
                    <a key={i} href={r.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all group">
                      <RIcon size={14} className="text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">{r.label}</p>
                        <p className="text-[10px] text-slate-600 truncate">{r.desc}</p>
                      </div>
                    </a>
                  ) : (
                    <Link key={i} href={r.href}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all group">
                      <RIcon size={14} className="text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">{r.label}</p>
                        <p className="text-[10px] text-slate-600 truncate">{r.desc}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
