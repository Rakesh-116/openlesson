"use client";

interface FeedbackPanelProps {
  objectives: string[];
  objectiveStatuses?: ("red" | "yellow" | "green" | "blue")[];
}

const statusConfig = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    dot: "bg-blue-500",
    label: "Not started",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-500",
    label: "Struggling",
  },
  yellow: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    dot: "bg-yellow-500",
    label: "In Progress",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    dot: "bg-green-500",
    label: "On Track",
  },
};

export function FeedbackPanel({ objectives, objectiveStatuses }: FeedbackPanelProps) {
  return (
    <div className="w-64 shrink-0 flex flex-col gap-4 p-4 bg-neutral-900/30 border-l border-neutral-800 overflow-y-auto">
      {/* Objectives Section */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-3">
          Session Objectives
        </div>
        <div className="flex flex-col gap-2">
          {objectives.length > 0 ? (
            objectives.map((objective, index) => {
              const status = objectiveStatuses?.[index] || "blue";
              const statusConf = statusConfig[status];
              
              return (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-2.5 rounded-lg ${statusConf.bg} border ${statusConf.border}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1 ${statusConf.dot}`} />
                  <div className="flex-1">
                    <span className="text-[10px] font-mono text-neutral-500 block mb-0.5">
                      Objective {index + 1}
                    </span>
                    <span className={`text-xs ${statusConf.text} leading-relaxed`}>
                      {objective}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-neutral-600 italic p-2">
              Loading objectives...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
