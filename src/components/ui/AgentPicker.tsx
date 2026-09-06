import { Check, Cpu, Terminal } from "lucide-react";
import type { AgentType } from "@/types";

export function AgentPicker({
  value,
  onChange,
  disabled = false,
  label = "Choose an agent",
}: {
  value: AgentType;
  onChange: (value: AgentType) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <fieldset className="field-group" disabled={disabled}>
      <legend className="field-label">{label}</legend>
      <div className="agent-picker">
        {(["codex", "claude"] as const).map((agent) => (
          <label
            className="agent-option"
            data-agent={agent}
            data-selected={value === agent}
            key={agent}
          >
            <input
              type="radio"
              name={label}
              value={agent}
              checked={value === agent}
              onChange={() => onChange(agent)}
            />
            <span className="agent-option-icon">
              {agent === "codex" ? <Terminal size={20} /> : <Cpu size={20} />}
            </span>
            <span>
              <strong>{agent === "codex" ? "Codex" : "Claude Code"}</strong>
              <small>{agent === "codex" ? "OpenAI" : "Anthropic"}</small>
            </span>
            {value === agent && (
              <Check size={16} className="agent-option-check" />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
