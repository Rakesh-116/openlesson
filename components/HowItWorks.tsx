"use client";

interface Step {
  icon: string;
  title: string;
  description: string;
}

interface HowItWorksProps {
  title?: string;
  steps: Step[];
  cta?: {
    text: string;
    href: string;
  };
}

export function HowItWorks({ 
  title = "How It Works", 
  steps, 
  cta 
}: HowItWorksProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {title && (
        <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-8">
          {title}
        </h2>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
        {steps.map((step, index) => (
          <div key={index} className="relative flex flex-col items-center text-center">
            {/* Connector line (hidden on mobile, visible on md+) */}
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-slate-800" />
            )}
            
            {/* Step number badge */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl mb-4">
                {step.icon}
              </div>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs text-slate-300 font-medium">
                {index + 1}
              </span>
            </div>
            
            <h3 className="text-base font-medium text-white mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              {step.description}
            </p>
          </div>
        ))}
      </div>
      
      {cta && (
        <div className="mt-10 text-center">
          <a
            href={cta.href}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-200 hover:bg-white text-slate-900 text-sm font-medium rounded-xl transition-colors"
          >
            {cta.text}
          </a>
        </div>
      )}
    </div>
  );
}
