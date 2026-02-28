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
              <div className="text-sm font-medium text-blue-400 mb-1">Left Panel</div>
              <p className="text-xs text-neutral-500">
                Access chat, canvas, notebook, RAG matching, and prep tools
              </p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-blue-400 mb-1">Center</div>
              <p className="text-xs text-neutral-500">
                Your active workspace - chat with AI tutor, draw on canvas, or take notes
              </p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
              <div className="text-sm font-medium text-blue-400 mb-1">Right Panel</div>
              <p className="text-xs text-neutral-500">
                Socratic questions and feedback from your tutor
              </p>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Tools</h4>
          <div className="space-y-2 text-xs text-neutral-400">
            <p><span className="text-cyan-400 font-medium">LLM Chat</span> - Talk with AI tutor generating Socratic questions</p>
            <p><span className="text-cyan-400 font-medium">Canvas</span> - Whiteboard for diagrams and visual thinking</p>
            <p><span className="text-cyan-400 font-medium">Notebook</span> - Scratchpad for thoughts and insights</p>
            <p><span className="text-cyan-400 font-medium">RAG Matches</span> - Past session chunks for tutor context</p>
            <p><span className="text-cyan-400 font-medium">Grokipedia</span> - External knowledge search</p>
            <p><span className="text-cyan-400 font-medium">Exercise Prep</span> - Pre-session practice task</p>
            <p><span className="text-cyan-400 font-medium">Prep Reading</span> - Key concepts to review</p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">How It Works</h4>
          <ol className="text-xs text-neutral-400 space-y-1 list-decimal list-inside">
            <li>Start with a topic you want to learn</li>
            <li>Tutor generates a starting question</li>
            <li>Record your thinking out loud</li>
            <li>Tutor analyzes and asks Socratic questions</li>
            <li>Use tools as needed</li>
            <li>End when you feel confident</li>
          </ol>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Shortcuts</h4>
          <p className="text-xs text-neutral-500">Space - Hold to record | R - Request feedback | I - Stuck</p>
        </div>
      </div>
    </div>
  );
}
