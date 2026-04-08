import { useI18n } from "@/lib/i18n";

export function ToolsHelp() {
  const { t } = useI18n();
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-white mb-3">{t('tools.sessionWorkspace')}</h3>
          <p className="text-sm text-neutral-400 mb-4">
            {t('tools.workspaceDesc')}
          </p>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-purple-400 mb-1">{t('tools.leftSidebar')}</div>
              <p className="text-xs text-neutral-500">{t('tools.leftSidebarDesc')}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-cyan-400 mb-1">{t('tools.centerPanel')}</div>
              <p className="text-xs text-neutral-500">{t('tools.centerPanelDesc')}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-blue-400 mb-1">{t('tools.rightPanel')}</div>
              <p className="text-xs text-neutral-500">{t('tools.rightPanelDesc')}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-white mb-2">{t('tools.tools')}</h4>
          <div className="space-y-2 text-xs text-neutral-400">
            <p><span className="text-cyan-400 font-medium">{t('tools.teachingAssistant')}</span> — {t('tools.teachingAssistantDesc')}</p>
            <p><span className="text-cyan-400 font-medium">{t('tools.canvas')}</span> — {t('tools.canvasDesc')}</p>
            <p><span className="text-cyan-400 font-medium">{t('tools.notebook')}</span> — {t('tools.notebookDesc')}</p>
            <p><span className="text-cyan-400 font-medium">{t('tools.grokipedia')}</span> — {t('tools.grokipediaSearch')}</p>
            <p><span className="text-cyan-400 font-medium">{t('tools.practice')}</span> — {t('tools.practiceDesc')}</p>
            <p><span className="text-cyan-400 font-medium">{t('tools.theory')}</span> — {t('tools.theoryDesc')}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-white mb-2">{t('tools.utilityTools')}</h4>
          <div className="space-y-2 text-xs text-neutral-400">
            <p><span className="text-purple-400 font-medium">{t('tools.help')}</span> — {t('tools.helpDesc')}</p>
            <p><span className="text-purple-400 font-medium">{t('tools.dataInput')}</span> — {t('tools.dataInputDesc')}</p>
            <p><span className="text-purple-400 font-medium">{t('tools.logs')}</span> — {t('tools.logsDesc')}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-white mb-2">{t('tools.sessionControls')}</h4>
          <div className="space-y-1 text-xs text-neutral-400">
            <p><span className="text-neutral-300 font-medium">{t('tools.startSession')}</span> — {t('tools.startSessionDesc')}</p>
            <p><span className="text-neutral-300 font-medium">{t('tools.pause')}</span> — {t('tools.pauseDesc')}</p>
            <p><span className="text-neutral-300 font-medium">{t('tools.resume')}</span> — {t('tools.resumeDesc')}</p>
            <p><span className="text-neutral-300 font-medium">{t('tools.reset')}</span> — {t('tools.resetDesc')}</p>
            <p><span className="text-neutral-300 font-medium">{t('tools.close')}</span> — {t('tools.closeDesc')}</p>
            <p><span className="text-neutral-300 font-medium">{t('tools.endSession')}</span> — {t('tools.endSessionDesc')}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-white mb-2">{t('tools.howItWorks')}</h4>
          <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal list-inside">
            <li>{t('tools.step1')}</li>
            <li>{t('tools.step2')}</li>
            <li>{t('tools.step3')}</li>
            <li>{t('tools.step4')}</li>
            <li>{t('tools.step5')}</li>
            <li>{t('tools.step6')}</li>
            <li>{t('tools.step7')}</li>
          </ol>
        </div>

        <div>
          <h4 className="text-sm font-medium text-white mb-2">{t('tools.keyboardShortcut')}</h4>
          <p className="text-xs text-neutral-400">
            <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono">{t('tools.space')}</span>
            <span className="ml-2">{t('tools.spaceDesc')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
