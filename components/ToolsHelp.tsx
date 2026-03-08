export function ToolsHelp() {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-white mb-3">Session Workspace</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Your session workspace is divided into three main areas
          </p>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-purple-400 mb-1">Left Toolbar</div>
              <p className="text-xs text-neutral-500">
                Main tools at top, utility tools (Help, Data Input, Logs, RAG) anchored at bottom
              </p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-blue-400 mb-1">Center Panel</div>
              <p className="text-xs text-neutral-500">
                Active workspace - chat with AI tutor, draw on canvas, take notes, view prep materials
              </p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-blue-400 mb-1">Right Panel</div>
              <p className="text-xs text-neutral-500">
                Guiding questions and feedback from your tutor
              </p>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Tools</h4>
          <div className="space-y-2 text-xs text-neutral-400">
            <p><span className="text-cyan-400 font-medium">Teaching Assistant</span> - Talk with AI tutor generating guiding questions</p>
            <p><span className="text-cyan-400 font-medium">Topic & Goals</span> - Problem statement and learning objectives</p>
            <p><span className="text-cyan-400 font-medium">Canvas</span> - Whiteboard for diagrams and visual thinking</p>
            <p><span className="text-cyan-400 font-medium">Notebook</span> - Scratchpad for thoughts and insights</p>
            <p><span className="text-cyan-400 font-medium">Grokipedia</span> - External knowledge search</p>
            <p><span className="text-cyan-400 font-medium">Practice</span> - Pre-session practice task (auto-loads on click)</p>
            <p><span className="text-cyan-400 font-medium">Theory</span> - Key concepts to review (auto-loads on click)</p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Utility Tools (Bottom)</h4>
          <div className="space-y-2 text-xs text-neutral-400">
            <p><span className="text-purple-400 font-medium">RAG Matches</span> - Past session chunks for tutor context</p>
            <p><span className="text-purple-400 font-medium">Data Input</span> - Configure EEG and webcam settings</p>
            <p><span className="text-purple-400 font-medium">Logs</span> - Session logs and data transfer health monitoring</p>
            <p><span className="text-purple-400 font-medium">Help</span> - This help guide</p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Data Transfer Health</h4>
          <p className="text-xs text-neutral-500 mb-2">
            The Logs tool displays real-time transfer status for:
          </p>
          <div className="space-y-1 text-xs text-neutral-400">
            <p><span className="text-emerald-400 font-medium">Audio</span> - Voice recording chunks</p>
            <p><span className="text-emerald-400 font-medium">EEG</span> - Brain wave data (if Muse connected)</p>
            <p><span className="text-emerald-400 font-medium">Facial</span> - Webcam engagement data (if enabled)</p>
          </div>
          <p className="text-xs text-neutral-600 mt-2">
            Shows sent, saved, and failed counts with status indicators (Idle/OK/Issues)
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">How It Works</h4>
          <ol className="text-xs text-neutral-400 space-y-1 list-decimal list-inside">
            <li>Start with a topic you want to learn</li>
            <li>Tutor generates a starting question</li>
            <li>Record your thinking out loud</li>
            <li>Tutor analyzes and asks guiding questions</li>
            <li>Use tools as needed (canvas, notebook, prep materials)</li>
            <li>End when you feel confident</li>
          </ol>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Shortcuts</h4>
          <p className="text-xs text-neutral-500">Space - Force a new probe | R - Request feedback | I - Stuck</p>
        </div>
      </div>
    </div>
  );
}
