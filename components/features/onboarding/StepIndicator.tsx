interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { number: 1, label: "Marque" },
  { number: 2, label: "Questions" },
  { number: 3, label: "Rivaux" },
] as const;

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div>
      {/* Label */}
      <p className="text-[#6B54FA] text-[11px] font-medium tracking-widest uppercase">
        ÉTAPE {currentStep}/3
      </p>

      {/* Segments */}
      <div className="flex gap-2 mt-2">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className={`h-[3px] w-12 rounded-full ${
              step.number <= currentStep ? "bg-[#6B54FA]" : "bg-[#D1D5DB]"
            }`}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex gap-2 mt-2">
        {STEPS.map((step) => (
          <span
            key={step.number}
            className={`text-[11px] w-12 ${
              step.number === currentStep
                ? "text-[#6B54FA] font-medium"
                : "text-[#9CA3AF]"
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
